---
layout: page
title:  Scaling Shiny Applications
description: How to scale up dockerized shiny applications
img: /assets/img/shiny_proxy.png
---
If you saw my previous post about dockerizing Shiny applications, you know it's
possible to turn a Shiny application into a standalone Shiny web app. The challenge,
however, is that each instance is resource intensive. One way to solve this is by
using Shiny Server...at a cost of ~$15,000. Since this is just slightly outside my
budget, I looked for a different way. I came across [ShinyProxy](https://www.shinyproxy.io)
and it seemed to fit my needs perfectly.

The website does a great job of getting you started. Here are some of the challenges I faced
and how I solved them.

### Installation
I first needed to install Java and Maven using:
```
apt install jre8-openjdk-headless
apt install maven
```

ShinyProxy needs to connect to the docker daemon to spin up the containers for the Shiny apps.
By default ShinyProxy will do so on port 2375 of the docker host. In order to allow for connections
on port 2375, the startup options need to be edited. In Ubuntu 18.04 this looks like:
```
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H unix:// -D -H tcp://127.0.0.1:2375
```
And restart the service using:
```
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### Configuration
This might have been the most challenging part. I went with a simple configuration file
by modifying the `application.yaml` located at `/etc/shinyproxy/application.yaml` as such:

```
proxy:
  title: CV Risk Scores
  logo-url: http://www.openanalytics.eu/sites/www.openanalytics.eu/themes/oa/logo.png
  landing-page: /
  heartbeat-rate: 10000
  heartbeat-timeout: 60000
  port: 8080
  authentication: none
  # Docker configuration
  docker:
    url: http://localhost:2375
    port-range-start: 20000
  specs:
  - id: watchdm
    display-name: WATCH-DM
    description: Calculate the WATCH-DM risk score
    container-cmd: ["/usr/bin/shiny-server.sh"]
    container-image: watchdm
    port: 3838
logging:
  file:
    shinyproxy.log
```

### Reverse Proxy
This worked! But the URL was ugly. I wanted to change it to something more appealing.
Enter nginx. I installed nginx per the instructions and made a new server block as follows in
`/etc/nginx/sites-available/cvriskscores.com`:
```
server {
        listen 80;
        listen [::]:80;

        server_name shinyproxy.cvriskscores.com;

        location / {
                proxy_pass http://127.0.0.1:8080;
        }
}
```
