---
layout: page
permalink: /
title: about
nav: about
---

<div class="text-center mt-5">
  <img class="profile-img" src="{{ 'prof_pic.jpg' | prepend: '/assets/img/' | prepend: site.baseurl }}">
</div>

<div class="col mt-4">
  <h1 class="title text-center font-weight-bold">Matt Segar</h1>
</div>

<!-- Introduction -->

<div class="col text-justify p-0">
  I am a second-year Internal Medicine resident at <a href="https://www.utsouthwestern.edu/education/medical-school/departments/internal-medicine/education-training/residency/" target="_blank">UT Southwestern Medical Center</a>. I graduated with a degree in computer science with Honors from Bucknell University and
  a Masters of Science in Bioinformatics from Indiana University. I received my medical degree from the Indiana University School of Medicine. I am
  currently plan on applying for cardiology fellowship upon completion of my residency training. My current research focuses on using machine learning and artificial intelligence to improve risk prediction and tailor medical therapies to identify and treat heart failure.
<br>
  You may find more information about our research at <a href="https://www.cvriskscores.com" target="_blank">CV Risk Scores</a>.
</div>

<!-- News -->
<div class="news mt-3 p-0">
  <h1 class="title mb-4 p-0">news</h1>
  {% assign news = site.news | reverse %}
  {% for item in news limit: site.news_limit %}
    <div class="row p-0">
      <div class="col-sm-2 p-0">
        <span class="badge danger-color-dark font-weight-bold text-uppercase align-middle date ml-3">
          {{ item.date | date: "%b %-d, %Y" }}
        </span>
      </div>
      <div class="col-sm-10 mt-2 mt-sm-0 ml-3 ml-md-0 p-0 font-weight-light text">
        <p>{{ item.content | remove: '<p>' | remove: '</p>' | emojify }}</p>
      </div>
    </div>
  {% endfor %}
</div>
