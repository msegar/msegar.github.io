---
title: R Plumber API on Heroku
description: Deploy a R Plumber API on Heroku for serving machine learning models
date: 2025-02-27
img: ../assets/images/heroku.png
categories: [R, API, Deployment, Heroku]
---

Deploying and self-hosting a R API using Plumber is difficult. I've been trying to
use DigitalOcean and Docker services, but have had trouble with uptime. I recently
came across a blog article by [Magnus Furugard](https://medium.com/@magnus.furugard/r-docker-heroku-rest-api-30c351f9c194)
and realized [Heroku](www.heroku.com) could be an ideal solution. In short, Heroku
has been a life saver! My goal in this post is to walk you through steps to implement
a R Plumber API yourself.


### R and Plumber
The first step is to have a working R Plumber API. Using RStudio, the process is
trivial. Create a Plumber API project and set up your files as follows.

```sh
app/
  |- init.R
  |- app.R
  |- plumber.R
```

The <code>init.R</code> file is used to install needed packages.

```r
my_packages = c("plumber","randomForestSRC")
install_if_missing = function(p) {
  if (p %in% rownames(installed.packages()) == FALSE) {
    install.packages(p, dependencies = TRUE)
  }
  else {
    cat(paste("Skipping already installed package:", p, "\n"))
  }
}
invisible(sapply(my_packages, install_if_missing))
```

The <code>app.R</code> file is what's used to establish the API. The critical lines are the host needs to be 0.0.0.0 and port is set as the main Heroku port.

```r
library(plumber)
port <- Sys.getenv('PORT')
server <- plumb("plumber.R")
server$run(
	host = '0.0.0.0',
	port = as.numeric(port),
	swagger=TRUE
)
```

Finally, the <code>plumber.R</code> file is the main API file. Here is where you establish the API endpoints specific to your application. Since the goal of this application was to predict heart failure risk, I used a /predict endpoint. Of note, since the API will be accessed from various websites and applications, CORS is required.

```r
library(plumber)
library(randomForestSRC)
# Load model
rf_model <- readRDS("model.Rds")
#* @filter cors
cors <- function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$setHeader("Access-Control-Allow-Methods","*")
    res$setHeader("Access-Control-Allow-Headers", req$HTTP_ACCESS_CONTROL_REQUEST_HEADERS)
    res$status <- 200
    return(list())
  } else {
    plumber::forward()
  }
}
#* Submit data and get a prediction in return
#* @post /predict
function(req, res) {
  data <- tryCatch(jsonlite::parse_json(req$postBody, simplifyVector = TRUE),
                   error = function(e) NULL)
  if (is.null(data)) {
    res$status <- 400
    list(error = "No data submitted")
  }
  data <- data.frame(data)
  ret <- predict(rf_model, data)
  ret <- ret$chf[,length(ret$time.interest)]
  ret
}
```

### Heroku
First, make sure the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) is installed on your machine. Next, make sure the [Heroku R Buildpack](https://github.com/virtualstaticvoid/heroku-buildpack-r) is specified in the application settings.

Once applied, navigate to the root of your application folder. Finally, push the application files to the stack and enjoy!

```sh
git init
git add .
git commit -m 'initial'
git push heroku master
```