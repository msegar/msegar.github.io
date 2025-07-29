---
title: Building a Simple Static Blog with JavaScript and Markdown
description: How to create a lightweight, SEO-friendly blog using markdown files, JavaScript, and static HTML templates
date: 2025-03-30
img: ../assets/images/static-blog.png
categories: [JavaScript, Markdown, Web Development]
---

# Building a Simple Static Blog with JavaScript and Markdown

As a developer who values simplicity and performance, I've always been drawn to static site generators. While there are many excellent options like Jekyll, Hugo, and Eleventy, sometimes you want something tailored precisely to your needs without the overhead of learning a new framework. That's why I built a custom, lightweight blogging system for my personal website using JavaScript, Markdown, and HTML templates.

## Why Build a Custom Blog System?

When redesigning my personal website, I had a few specific requirements:

1. **Content in Markdown** - I wanted to write in Markdown for ease of use and portability
2. **Simple file structure** - No complex database, just files and folders
3. **SEO optimization** - Generated pages with proper meta tags, structured data, and sitemaps
4. **Minimal dependencies** - Just a few core npm packages
5. **Full control** - The ability to customize every aspect of the build process

After evaluating several existing solutions, I decided to build my own system that would tick all these boxes while being extremely lightweight.

## How It Works

The system consists of a few key components:

1. **Content files** - Markdown files with YAML frontmatter stored in a content directory
2. **HTML templates** - Template files with placeholders for dynamic content
3. **Build script** - A Node.js script that processes the markdown files and generates the static HTML

The build process is straightforward:

1. Read all markdown files from the content directory
2. Parse the frontmatter and markdown content
3. Convert markdown to HTML
4. Insert the HTML and metadata into the template
5. Generate an index page listing all posts
6. Create a sitemap and RSS feed for SEO

## The Build Script

The heart of the system is the build script, which handles the entire process of converting markdown to HTML and generating the blog pages. Here's a breakdown of how it works:

### Setting Up

The script starts by importing dependencies and defining paths:

```javascript
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const matter = require('gray-matter');

// Configure paths
const CONTENT_DIR = path.join(__dirname, '../content/posts');
const OUTPUT_DIR = path.join(__dirname, '../blog/posts');
const TEMPLATE_PATH = path.join(__dirname, '../blog/template.html');
```

### Processing Markdown Files

For each markdown file, the script:

1. Reads the file content
2. Parses the frontmatter and markdown using gray-matter
3. Generates a slug from the filename
4. Converts markdown to HTML using marked
5. Extracts metadata like date, title, description

```javascript
mdFiles.forEach(mdFile => {
  const filePath = path.join(CONTENT_DIR, mdFile);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Parse frontmatter and content
  const { data: frontmatter, content: markdownContent } = matter(content);
  
  // Generate slug from filename
  const slug = mdFile.replace('.md', '');
  
  // Convert markdown to HTML
  const htmlContent = marked.parse(markdownContent);
  
  // Create post object with metadata
  const post = {
    slug,
    title: frontmatter.title || 'Untitled Post',
    description: frontmatter.description || '',
    date: postDate,
    // Additional metadata...
  };

  // Generate HTML from template
  let postHtml = template
    .replace(/{{title}}/g, post.title)
    .replace(/{{date}}/g, formatDate(post.date))
    // Replace other placeholders...
    
  // Write to file
  fs.writeFileSync(outputPath, postHtml);
});
```

### Generating the Blog Index

The index page lists all blog posts in reverse chronological order. The script:

1. Sorts all posts by date
2. Generates HTML for each blog card
3. Inserts the HTML into the index template

The index template includes placeholders for the blog grid:

```html
<div class="blog-grid">
    <!-- Blog posts will be inserted here -->
</div>
```

The script replaces this with dynamically generated HTML for each post:

```javascript
const blogCardsHtml = posts.map(post => {
  return `
  <article class="blog-card">
      <div class="blog-thumbnail">
          ${post.img ? `<img src="${post.img}" alt="${post.title}">` : '<span>Featured Image</span>'}
      </div>
      <div class="blog-content">
          <h3 class="blog-title">${post.title}</h3>
          <div class="blog-meta">
              <span class="blog-date">${formatDate(post.date)}</span>
              <span class="blog-read-time">${readTime} min read</span>
          </div>
          <div class="blog-excerpt">
              <p>${post.description}</p>
          </div>
          <a href="posts/${post.slug}.html" class="button">Read More</a>
      </div>
  </article>
  `;
}).join('\n');
```

## SEO Optimization

One of the benefits of this approach is the ability to add comprehensive SEO features:

### Meta Tags

The template includes meta tags for social sharing and SEO:

```html
<!-- Primary Meta Tags -->
<meta name="description" content="{{description}}">
<meta name="author" content="Matt Segar">
<meta name="keywords" content="{{keywords}}">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="article">
<meta property="og:url" content="https://segar.me/blog/posts/{{slug}}.html">
<meta property="og:title" content="{{title}} - Matt Segar">
<meta property="og:description" content="{{description}}">
<meta property="og:image" content="{{img}}">

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image">
<!-- Additional Twitter tags... -->
```

### Structured Data

The system also includes structured data for rich search results:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "{{title}}",
  "description": "{{description}}",
  "image": "{{img}}",
  "author": {
    "@type": "Person",
    "name": "Matt Segar"
  },
  <!-- Additional structured data... -->
}
</script>
```

### Sitemap and RSS Feed

The script also generates a sitemap.xml and RSS feed to improve search engine indexing:

```javascript
function generateSitemap(posts) {
  const baseUrl = 'https://segar.me';
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  // Add homepage and other main pages...
  
  // Add blog posts
  posts.forEach(post => {
    sitemap += `  <url>
    <loc>${baseUrl}/blog/posts/${post.slug}.html</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  });
  
  sitemap += '</urlset>';
  
  // Write sitemap to file
  fs.writeFileSync(path.join(__dirname, '../sitemap.xml'), sitemap);
}
```

## Benefits of This Approach

Using this custom static blog system offers several advantages:

1. **Performance** - Static HTML pages are extremely fast to load
2. **Security** - No server-side processing means fewer security vulnerabilities
3. **Simplicity** - The entire system is just a few files
4. **Version control** - Content can be easily tracked in Git
5. **Flexibility** - Add new features or modify the build process as needed
6. **Low cost** - Host on GitHub Pages, Netlify, or any static hosting service for free or low cost

## Adding Content

With this system, adding a new blog post is as simple as:

1. Create a new markdown file in the content directory
2. Add frontmatter with metadata (title, description, date, etc.)
3. Write the post content in markdown
4. Run the build script to generate HTML
5. Deploy the updated files

```markdown
---
title: My New Blog Post
description: This is an example blog post
date: 2025-03-24
img: ../assets/images/example.png
categories: [Example, Blog]
---

# My New Blog Post

This is an example of how easy it is to create content with this system.
```

## Conclusion

Building a custom static blog system might seem like reinventing the wheel, but it offers a level of control and simplicity that's hard to match with off-the-shelf solutions. This approach is perfect for developers who want a lightweight, customizable blogging platform without the overhead of a full CMS or complex static site generator.

The entire system I've described is less than 300 lines of code, yet it provides all the essential features of a modern blog: markdown support, responsive design, SEO optimization, and easy content management.

If you're looking to create a personal blog or simple content website, consider this approach. It's lightweight, flexible, and puts you in complete control of your content.

Reach out to me if you'd like to see the full source code for this system. It's also hosted in my GitHub. 