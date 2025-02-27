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
  
  // Create post object
  const post = {
    slug,
    title: frontmatter.title || 'Untitled Post',
    description: frontmatter.description || '',
    date: postDate,
    img: frontmatter.img || '',
    categories: frontmatter.categories || [],
    content: markdownContent // Store content for calculating read time
  };
  
  // Add to posts array for index generation
  allPosts.push(post);
  
  // Replace template placeholders with content
  let postHtml = template
    .replace(/{{title}}/g, post.title)
    .replace(/{{date}}/g, formatDate(post.date))
    .replace(/{{description}}/g, post.description)
    .replace(/{{content}}/g, htmlContent);
  
  // Write the HTML file
  const outputPath = path.join(OUTPUT_DIR, `${slug}.html`);
  fs.writeFileSync(outputPath, postHtml);
  
  console.log(`Generated: ${outputPath}`);
});

// Sort posts by date (newest first)
allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

// Update the blog index page
generateBlogIndex(allPosts);

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
  
  // Write the updated index.html
  fs.writeFileSync(INDEX_PATH, newIndexHtml);
  console.log(`Updated blog index with ${posts.length} posts`);
}

console.log('Blog build complete!');