---
title: Migrating Static Sites to Dokploy with Traefik and Let's Encrypt
description: A practical guide to hosting static sites on Dokploy, including React SPAs, SSL certificates, and the networking gotchas that will save you hours.
date: 2026-01-21
img: ../assets/images/dokploy.png
categories: [DevOps, Docker, Nginx, Traefik]
---

I recently migrated two static sites from nginx on bare metal to Dokploy with Traefik reverse proxy. What should have been a 15-minute job turned into several hours of debugging Docker networking, SSL certificate resolvers, and load balancer configurations. Here's what I learned so you don't have to.

## Why Dokploy?

Dokploy is a self-hosted PaaS (think Heroku/Vercel for your own VPS) that uses Docker Compose under the hood with Traefik as the reverse proxy. It handles:

- **Automatic SSL** via Let's Encrypt
- **Zero-downtime deployments**
- **Built-in monitoring**
- **Simple UI** for managing services

I had two sites running on nginx with Cloudflare SSL certificates:
- `cvriskscores.com` - A basic static HTML site
- `prolegohealth.com` - A React SPA with client-side routing

Both were behind Cloudflare with Authenticated Origin Pulls enabled, which added complexity to the migration.

## The Basic Setup

### Prerequisites

- A VPS with Dokploy installed
- Static files in `/var/www/yoursite.com/html`
- Domain pointing to your server
- Cloudflare (optional, but common)

### Step 1: Disable Your Existing nginx
```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

Dokploy's Traefik will bind to ports 80 and 443, so nginx needs to be out of the way.

### Step 2: Create a Docker Compose File

For a basic static site, create this in Dokploy's UI under "Services" → "Compose":
```yaml
version: '3.8'
services:
  mysite:
    image: nginx:alpine
    volumes:
      - /var/www/yoursite.com/html:/usr/share/nginx/html:ro
    networks:
      - dokploy-network
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=dokploy-network"
      - "traefik.http.routers.mysite.rule=Host(`yoursite.com`) || Host(`www.yoursite.com`)"
      - "traefik.http.routers.mysite.entrypoints=websecure"
      - "traefik.http.routers.mysite.tls=true"
      - "traefik.http.routers.mysite.tls.certresolver=letsencrypt"
      - "traefik.http.services.mysite.loadbalancer.server.port=80"
      # HTTP to HTTPS redirect
      - "traefik.http.middlewares.mysite-redirect.redirectscheme.scheme=https"
      - "traefik.http.routers.mysite-http.rule=Host(`yoursite.com`) || Host(`www.yoursite.com`)"
      - "traefik.http.routers.mysite-http.entrypoints=web"
      - "traefik.http.routers.mysite-http.middlewares=mysite-redirect"

networks:
  dokploy-network:
    external: true
```

### Step 3: Deploy

Click "Deploy" in Dokploy. The service should start in 10-20 seconds.

## The Gotchas That Cost Me Hours

### 1. The Load Balancer Port (Gateway Timeout)

**The error:**
```
HTTP/2 504 Gateway Timeout
```

**The problem:** Traefik didn't know which port to forward traffic to inside the container.

**The fix:** Add this label:
```yaml
- "traefik.http.services.mysite.loadbalancer.server.port=80"
```

Without this, Traefik attempts to auto-detect the port. If your container exposes multiple ports or Traefik guesses wrong, you get timeouts.

### 2. Docker Network Isolation

**The error:**
```
wget: bad address 'mysite-container-name'
```

**The problem:** By default, Docker Compose creates an isolated network for each service. Traefik runs on `dokploy-network`, but your service runs on `myservice_default`. They can't talk to each other.

**The fix:** Two labels are required:
```yaml
networks:
  - dokploy-network

labels:
  - "traefik.docker.network=dokploy-network"  # Tell Traefik which network to use
```

The first connects your container to the network. The second tells Traefik to route via that network. **Both are necessary.**

### 3. React SPA Routing (404s on Refresh)

**The problem:** Refreshing `/about` in a React app returns a 404 because nginx looks for a file called `about`, which doesn't exist.

**The fix:** Create an nginx config that serves `index.html` for all routes:

`/var/www/yoursite.com/nginx.conf`:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Then mount it in your compose file:
```yaml
volumes:
  - /var/www/yoursite.com/html:/usr/share/nginx/html:ro
  - /var/www/yoursite.com/nginx.conf:/etc/nginx/conf.d/default.conf:ro
```

### 4. Cloudflare Authenticated Origin Pulls

**The problem:** If you had Authenticated Origin Pulls enabled with your old nginx setup, it won't work with Let's Encrypt certificates.

**The fix:** Go to Cloudflare → SSL/TLS → Origin Server and **disable** Authenticated Origin Pulls. Let's Encrypt certificates are trusted by Cloudflare's "Full (strict)" mode without additional client certificates.

Alternatively, keep your Cloudflare origin certificates and configure Traefik to use them (more complex).

### 5. Let's Encrypt Certificate Location

**The problem:** Certificates weren't being generated.

**The check:** Verify Let's Encrypt is configured in Traefik:
```bash
cat /etc/dokploy/traefik/traefik.yml | grep -A 10 certificatesResolvers
```

Expected output:
```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your@email.com
      storage: /etc/dokploy/traefik/dynamic/acme.json
      httpChallenge:
        entryPoint: web
```

Certificates are stored in `/etc/dokploy/traefik/dynamic/acme.json`. You can inspect them:
```bash
cat /etc/dokploy/traefik/dynamic/acme.json
```

If the file is empty or doesn't exist, check Traefik logs:
```bash
docker logs $(docker ps | grep traefik | awk '{print $1}') --tail 100
```

### 6. Old Containers Causing Conflicts

**The problem:** Deploying and redeploying in Dokploy can leave behind stopped containers that still have Traefik labels, causing routing conflicts.

**The fix:** Clean up old containers:
```bash
docker ps -a | grep your-service-name
docker rm $(docker ps -a | grep your-service-name-old | awk '{print $1}')
```

Or configure Dokploy to auto-remove stopped containers.

## Cloudflare Configuration

If you're using Cloudflare:

1. **DNS Settings:**
   - A record: `yoursite.com` → Your VPS IP
   - A record: `www.yoursite.com` → Your VPS IP
   - Proxy status: **ON** (orange cloud)

2. **SSL/TLS Settings:**
   - Mode: **Full (strict)**
   - Authenticated Origin Pulls: **OFF**
   - Always Use HTTPS: **ON**

3. **Edge Certificates:**
   - Should auto-provision via Cloudflare Universal SSL
   - No action needed

## Performance Optimizations

### Enable Gzip Compression

Add to your nginx config:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
gzip_min_length 1000;
```

### Asset Caching

The config above already includes cache headers for static assets. For a production setup, consider using CloudFlare's caching:

- Go to Caching → Configuration
- Set Browser Cache TTL to 4 hours or more
- Enable Auto Minify for JS/CSS/HTML

## Debugging Checklist

When something doesn't work:

1. **Is the container running?**
```bash
   docker ps | grep your-service
```

2. **Can the container be accessed locally?**
```bash
   curl -I http://localhost -H "Host: yoursite.com"
```

3. **Is the container on the right network?**
```bash
   docker inspect <container-id> | grep -A 10 Networks
```
   Should show `dokploy-network`.

4. **Are Traefik labels correct?**
```bash
   docker inspect <container-id> | grep -A 30 Labels
```

5. **Check Traefik logs:**
```bash
   docker logs $(docker ps | grep traefik | awk '{print $1}') --tail 50
```

6. **Test SSL certificate:**
```bash
   curl -Ik https://yoursite.com
```

## The Complete Working Config

Here's the final compose file for the React SPA with all gotchas fixed:
```yaml
version: '3.8'
services:
  prolegohealth:
    image: nginx:alpine
    volumes:
      - /var/www/prolegohealth.com/html:/usr/share/nginx/html:ro
      - /var/www/prolegohealth.com/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - dokploy-network
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=dokploy-network"
      - "traefik.http.routers.prolegohealth.rule=Host(`prolegohealth.com`) || Host(`www.prolegohealth.com`)"
      - "traefik.http.routers.prolegohealth.entrypoints=websecure"
      - "traefik.http.routers.prolegohealth.tls=true"
      - "traefik.http.routers.prolegohealth.tls.certresolver=letsencrypt"
      - "traefik.http.services.prolegohealth.loadbalancer.server.port=80"
      - "traefik.http.middlewares.prolegohealth-redirect.redirectscheme.scheme=https"
      - "traefik.http.routers.prolegohealth-http.rule=Host(`prolegohealth.com`) || Host(`www.prolegohealth.com`)"
      - "traefik.http.routers.prolegohealth-http.entrypoints=web"
      - "traefik.http.routers.prolegohealth-http.middlewares=prolegohealth-redirect"

networks:
  dokploy-network:
    external: true
```

## Final Thoughts

Migrating to Dokploy simplified my deployment workflow, but the learning curve around Traefik labels and Docker networking was steeper than expected. The key lessons:

1. **Always specify the load balancer port** - don't rely on auto-detection
2. **Network configuration is critical** - both the `networks:` block and the `traefik.docker.network` label
3. **React SPAs need special nginx configs** - `try_files` is essential
4. **Disable Cloudflare Authenticated Origin Pulls** unless you're using Cloudflare Origin Certificates
5. **Check Traefik logs early** - they'll show routing conflicts and certificate issues

The whole migration took a few hours with debugging, but now deployments are trivial. No more manual nginx config edits, no certificate renewals to worry about, and a clean UI for managing services.

---

*Questions? Hit a different gotcha? Let me know - I'm happy to update this guide.*