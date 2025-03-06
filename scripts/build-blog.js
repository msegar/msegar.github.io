// build-blog.js - Script to build blog posts from markdown
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const matter = require('gray-matter');

// Configure paths
const CONTENT_DIR = path.join(__dirname, '../content/posts');
const OUTPUT_DIR = path.join(__dirname, '../blog/posts');
const TEMPLATE_PATH = path.join(__dirname, '../blog/template.html');
const INDEX_TEMPLATE_PATH = path.join(__dirname, '../blog/index-template.html');
const INDEX_PATH = path.join(__dirname, '../blog/index.html');

// Common English words to exclude from keywords
const commonWords = [
  'this', 'that', 'these', 'those', 'with', 'from', 'have', 'will', 'been', 'were', 
  'they', 'them', 'their', 'when', 'what', 'where', 'which', 'would', 'could', 'should', 
  'about', 'there', 'other', 'more', 'some', 'such', 'only', 'then', 'also', 'very', 
  'just', 'like', 'than', 'into', 'over', 'most', 'after', 'before', 'between'
];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read the blog post template
let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

// Keep track of all posts for index page
let allPosts = [];

// Process each markdown file
const mdFiles = fs.readdirSync(CONTENT_DIR).filter(file => file.endsWith('.md'));

mdFiles.forEach(mdFile => {
  const filePath = path.join(CONTENT_DIR, mdFile);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Parse frontmatter and content
  const { data: frontmatter, content: markdownContent } = matter(content);
  
  // Generate slug from filename (remove extension)
  const slug = mdFile.replace('.md', '');
  
  // Convert markdown to HTML
  const htmlContent = marked.parse(markdownContent);
  
  // Extract and normalize the date from frontmatter
  let postDate = frontmatter.date || new Date().toISOString().split('T')[0];
  
  // If date is already a formatted string like "February 14, 2025", keep it as is
  // Otherwise, ensure it's in a standard format (ISO string preferred)
  if (typeof postDate === 'object' && postDate instanceof Date) {
    postDate = postDate.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
  }
  
  // Generate keywords if not provided in frontmatter
  const keywords = frontmatter.keywords || extractKeywords(markdownContent, frontmatter.title || 'Untitled Post');
  
  // Create post object
  const post = {
    slug,
    title: frontmatter.title || 'Untitled Post',
    description: frontmatter.description || '',
    date: postDate,
    isoDate: new Date(postDate).toISOString(),
    img: frontmatter.img || '',
    categories: frontmatter.categories || [],
    keywords: keywords,
    content: markdownContent // Store content for calculating read time
  };
  
  // Add to posts array for index generation
  allPosts.push(post);
  
  // Replace template placeholders with content
  let postHtml = template
    .replace(/{{title}}/g, post.title)
    .replace(/{{date}}/g, formatDate(post.date))
    .replace(/{{isoDate}}/g, post.isoDate)
    .replace(/{{description}}/g, post.description)
    .replace(/{{content}}/g, htmlContent)
    .replace(/{{slug}}/g, post.slug)
    .replace(/{{img}}/g, post.img)
    .replace(/{{keywords}}/g, post.keywords);
  
  // Write the HTML file
  const outputPath = path.join(OUTPUT_DIR, `${slug}.html`);
  fs.writeFileSync(outputPath, postHtml);
  
  console.log(`Generated: ${outputPath}`);
});

// Sort posts by date (newest first)
allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

// Update the blog index page
generateBlogIndex(allPosts);

// Generate sitemap
generateSitemap(allPosts);

// Generate RSS feed
generateRSSFeed(allPosts);

// Create robots.txt file
generateRobotsTxt();

console.log('Blog build complete!');

// Helper Functions

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.log(`Warning: Invalid date format: ${dateString}. Using as-is.`);
      return dateString;
    }
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.log(`Error parsing date: ${dateString}`, error);
    return dateString;
  }
}

function calculateReadTime(content) {
  // Average reading speed is about 200-250 words per minute
  const wordCount = content.split(/\s+/).length;
  const readTime = Math.ceil(wordCount / 200);
  return readTime < 1 ? 1 : readTime;
}

function extractKeywords(content, title, maxKeywords = 5) {
  // Remove markdown syntax, code blocks, etc.
  const cleanContent = content
    .replace(/```[\s\S]*?```/g, '')  // Remove code blocks
    .replace(/`.*?`/g, '')           // Remove inline code
    .replace(/\[.*?\]\(.*?\)/g, '')  // Remove markdown links
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // Remove special characters
    .toLowerCase();
  
  // Get all words
  const words = cleanContent.split(/\s+/).filter(word => word.length > 3);
  
  // Count word frequency
  const wordFrequency = {};
  words.forEach(word => {
    if (!commonWords.includes(word)) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  });
  
  // Add title words as potential keywords
  title.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 3 && !commonWords.includes(word)) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 5; // Give higher weight to title words
    }
  });
  
  // Convert to array, sort by frequency, and take top keywords
  return Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(entry => entry[0])
    .join(', ');
}

function generateBlogIndex(posts) {
  // Check if we have an index template, otherwise use the current index as a template
  let indexTemplate;
  
  try {
    if (fs.existsSync(INDEX_TEMPLATE_PATH)) {
      indexTemplate = fs.readFileSync(INDEX_TEMPLATE_PATH, 'utf8');
    } else {
      // If no template exists, use current index.html as a template
      indexTemplate = fs.readFileSync(INDEX_PATH, 'utf8');
      
      // Save a copy as the template for future use
      fs.writeFileSync(INDEX_TEMPLATE_PATH, indexTemplate);
      console.log(`Created index template from current index.html`);
    }
  } catch (error) {
    console.error('Error reading index template:', error);
    return;
  }
  
  // Generate HTML for blog cards
  const blogCardsHtml = posts.map(post => {
    // Calculate reading time based on content length
    const readTime = calculateReadTime(post.content || '');
    
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
            <div class="blog-categories">
                ${(post.categories || []).map(cat => `<span class="blog-category">${cat}</span>`).join('')}
            </div>
        </div>
    </article>
    `;
  }).join('\n');
  
  // Create fresh index.html from template
  let newIndexHtml = indexTemplate;
  
  // Find the blog grid and replace its content
  const blogGridRegex = /<div class="blog-grid">[\s\S]*?<\/div>/;
  
  if (blogGridRegex.test(newIndexHtml)) {
    // Replace the content of the existing blog-grid div
    newIndexHtml = newIndexHtml.replace(
      blogGridRegex,
      `<div class="blog-grid">${blogCardsHtml}</div>`
    );
  } else {
    // If blog-grid div isn't found, add it after the container opening
    newIndexHtml = newIndexHtml.replace(
      /<section class="blog-content">\s*<div class="container">/,
      `<section class="blog-content">\n<div class="container">\n<div class="blog-grid">${blogCardsHtml}</div>`
    );
  }
  
  // Show or hide the placeholder message based on post count
  const placeholderRegex = /<div class="blog-placeholder-message"[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/;
  
  if (posts.length > 0) {
    // Remove placeholder completely if we have posts
    if (placeholderRegex.test(newIndexHtml)) {
      newIndexHtml = newIndexHtml.replace(placeholderRegex, '');
    }
  } else {
    // Make sure placeholder is visible if no posts
    if (placeholderRegex.test(newIndexHtml)) {
      const placeholderBlock = newIndexHtml.match(placeholderRegex)[0];
      const visiblePlaceholder = placeholderBlock.replace(
        /<div class="blog-placeholder-message".*?>/,
        '<div class="blog-placeholder-message">'
      );
      newIndexHtml = newIndexHtml.replace(placeholderRegex, visiblePlaceholder);
    }
  }
  
  // Add meta tags for SEO to the index page
  if (!newIndexHtml.includes('<meta name="description"')) {
    newIndexHtml = newIndexHtml.replace(
      '<title>',
      `<meta name="description" content="Matt Segar's Blog - Articles on data science, machine learning, and more.">\n    <title>`
    );
  }
  
  // Add canonical URL for index
  if (!newIndexHtml.includes('<link rel="canonical"')) {
    newIndexHtml = newIndexHtml.replace(
      '</head>',
      `    <link rel="canonical" href="https://segar.me/blog/index.html">\n</head>`
    );
  }
  
  // Write the updated index.html
  fs.writeFileSync(INDEX_PATH, newIndexHtml);
  console.log(`Updated blog index with ${posts.length} posts`);
}

function generateSitemap(posts) {
  const baseUrl = 'https://segar.me';
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  // Add homepage
  sitemap += `  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>\n`;
  
  // Add blog index
  sitemap += `  <url>
    <loc>${baseUrl}/blog/index.html</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>\n`;
  
  // Add other main pages
  const mainPages = ['cv.html', 'book.html', 'valabformatter/index.html'];
  mainPages.forEach(page => {
    sitemap += `  <url>
    <loc>${baseUrl}/${page}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  });
  
  // Add blog posts
  posts.forEach(post => {
    const postDate = new Date(post.date).toISOString().split('T')[0];
    sitemap += `  <url>
    <loc>${baseUrl}/blog/posts/${post.slug}.html</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  });
  
  sitemap += '</urlset>';
  
  // Write sitemap to the root directory
  fs.writeFileSync(path.join(__dirname, '../sitemap.xml'), sitemap);
  console.log('Generated sitemap.xml');
}

function generateRSSFeed(posts) {
  const baseUrl = 'https://segar.me';
  const now = new Date().toUTCString();
  
  let rss = '<?xml version="1.0" encoding="UTF-8"?>\n';
  rss += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n';
  rss += '<channel>\n';
  rss += '  <title>Matt Segar Blog</title>\n';
  rss += '  <link>https://segar.me/blog/</link>\n';
  rss += '  <description>Matt Segar\'s personal blog</description>\n';
  rss += '  <language>en-us</language>\n';
  rss += `  <lastBuildDate>${now}</lastBuildDate>\n`;
  rss += '  <atom:link href="https://segar.me/feed.xml" rel="self" type="application/rss+xml" />\n';
  
  // Add posts
  posts.slice(0, 10).forEach(post => {
    // Generate a description by extracting first few sentences or use the provided description
    const description = post.description || extractFirstParagraph(post.content);
    
    rss += '  <item>\n';
    rss += `    <title>${escapeXml(post.title)}</title>\n`;
    rss += `    <link>${baseUrl}/blog/posts/${post.slug}.html</link>\n`;
    rss += `    <guid>${baseUrl}/blog/posts/${post.slug}.html</guid>\n`;
    rss += `    <pubDate>${new Date(post.date).toUTCString()}</pubDate>\n`;
    rss += `    <description>${escapeXml(description)}</description>\n`;
    rss += '  </item>\n';
  });
  
  rss += '</channel>\n';
  rss += '</rss>';
  
  // Write RSS feed to the root directory
  fs.writeFileSync(path.join(__dirname, '../feed.xml'), rss);
  console.log('Generated feed.xml');
}

function generateRobotsTxt() {
  const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://segar.me/sitemap.xml
`;
  
  fs.writeFileSync(path.join(__dirname, '../robots.txt'), robotsTxt);
  console.log('Generated robots.txt');
}

// Helper function to escape XML entities
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Extract first paragraph for RSS description
function extractFirstParagraph(markdown) {
  const text = markdown.replace(/[#*`]/g, '');
  const firstParagraph = text.split('\n\n')[0].trim();
  
  // Limit to ~150 characters
  if (firstParagraph.length > 150) {
    return firstParagraph.substring(0, 147) + '...';
  }
  return firstParagraph;
}