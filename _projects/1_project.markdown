---
layout: page
title: R Shiny Docker
description: Creating a Docker Shiny web application in DigitalOcean
img: /assets/img/digitalocean.jpg
---

Shinyapps.io is expensive. Like very expensive. So I was tasked to find a better way. I came across this [blog](https://deanattali.com/2015/05/09/setup-rstudio-shiny-server-digital-ocean/)
that explains how to implement R Shiny in a DigitalOcean droplet.

DigitalOcean provides virtual private servers (they call each server a droplet), which means that you can pay $5/month to have your own server “in the cloud” that you can access from anywhere and host anything on.

If you also chose the weakest machine like I did, many packages won’t be able to install because of not enough memory. The key was to create a swap file.
I created 2GB of swap space.

```
sudo /bin/dd if=/dev/zero of=/var/swap.1 bs=1M count=2048
sudo /sbin/mkswap /var/swap.1
sudo /sbin/swapon /var/swap.1
sudo sh -c 'echo "/var/swap.1 swap swap defaults 0 0 " >> /etc/fstab'
```
And that's it! The site works well. I'll be updating this page in the future so keep a lookout for more details.

It's also worth noting that Jekyll throws an error when trying to compile due to localization issues. This can be solves by entering:

```
export LC_CTYPE="en_US.UTF-8"
```
