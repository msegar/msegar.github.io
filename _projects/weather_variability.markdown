---
layout: page
title:  Weather Variability
description: Which county has the highest variation in daily weather?
img: /assets/img/weather.png
---
I recently had a conversion with a friend about how Indianapolis has 'weird
weather' where it can be snowing one day and sunny the next. I wondered if this
was true - whether the Midwest has larger differences day-to-day weather
changes compared to other areas of the United States. Instead of guessing, I
decided to perform the analysis!

### Data
I downloaded daily weather data from the [NOAA Climate Data Online dataset repository](https://www.ncdc.noaa.gov/cdo-web/).
The dataset included maximum temperature readings from over 8,000 weather stations across
the United States.

### Analysis
I calculated the average successive variability (ASV) for each weather station in
the dataset. ASV is defined as the average absolute difference between successive
values. In R, this looks like:
```{r}
asv <- function(x){
  x <- x[!is.na(x)]
  v <- NULL
  for (i in seq(1,length(x)-1)){
    v[i] <- abs(x[i+1] - x[i])
  }
  return(mean(v))
}
```

I then binned the ASV values into 8 categories in order to see which counties
had the highest variability.

### Results
A choreopleth map of the results is below. The region with the most variability
was clearly the Midwest United States. The highest bin had ASV values ranging from 9-17
degrees fahrenheit. In other words, the day-to-day variability was on average 17 degrees!

Overall, this was a fun and quick exercise that showed the Midwest US has the
largest weather variability compared to other regions of the United States.

<div class="container-fluid p-0">
  <img class="img-responsive col-12" src="{{ '/assets/img/countyMap.png' | prepend: site.baseurl }}" alt="overview figure">
  <h6 class="font-italic text-center" style="color: #78909c;"><u>Figure 1:</u> Choreopleth map of the United States with bins of increasing weather variability.</h6>
</div>
