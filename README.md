# AI Marketing Demo - Modular Structure

This project has been refactored to follow a modular structure for better maintainability, scalability, and performance. The application provides AI-powered marketing workflow automation with enhanced accessibility features.

## Folder Structure

```
ai-marketing-demo/
├── index.html              # Main HTML file with semantic markup and accessibility features
├── css/                    # Stylesheets directory
│   ├── styles.css          # Main stylesheet with imports and responsive design
│   └── accessibility.css   # Comprehensive accessibility enhancements
├── js/                     # JavaScript directory
│   └── app.js              # Optimized application logic with performance improvements
└── components/             # Reusable components (future expansion)
```

## Features

### Modularity
- **HTML**: Clean semantic structure with proper ARIA attributes and skip links
- **CSS**: Separated into main styles and accessibility enhancements with CSS custom properties
- **JS**: Optimized application logic with DOM element caching and efficient function calls

### Accessibility Features
- Proper semantic HTML elements (`<header>`, `<main>`, `<section>`, `<nav>`)
- ARIA labels and roles for interactive elements
- Keyboard navigation support with focus indicators
- High contrast mode support via `prefers-contrast` media query
- Reduced motion support via `prefers-reduced-motion` media query
- Screen reader optimizations with skip links and proper labeling
- Sufficient color contrast with dynamic theming
- Proper heading hierarchy for content structure
- Accessible form controls with proper labeling
- Touch target sizes compliant with WCAG guidelines
- Dynamic color scheme support (light/dark mode)

### Performance Improvements
- External CSS and JS files for caching
- Optimized asset loading with Google Fonts
- DOM element caching to prevent repeated queries
- Efficient function calls avoiding redundant operations
- Optimized rendering pipeline
- Lazy loading considerations

### Responsive Design
- Mobile-first approach with responsive grid layouts
- Flexible components that adapt to different screen sizes
- Media queries for optimal viewing on all devices

## Files Overview

### index.html
Main entry point with:
- Semantic HTML structure with proper document outline
- Accessibility attributes and ARIA roles
- Skip links for screen reader users
- Responsive layout using CSS Grid and Flexbox
- Proper form labeling and structure

### css/styles.css
Main stylesheet that:
- Imports Google Fonts (Space Grotesk)
- Imports accessibility styles
- Defines CSS custom properties for consistent theming
- Implements responsive design with CSS Grid and Flexbox
- Includes dynamic light/dark mode support
- Contains all layout and visual styles

### css/accessibility.css
Comprehensive accessibility enhancements:
- Focus management with visible focus indicators
- Contrast adjustments for better readability
- Motion reduction for users with vestibular disorders
- Screen reader support with skip links and proper labeling
- Touch target sizing for mobile users
- Semantic structure support
- Dynamic color scheme compatibility

### js/app.js
Optimized application logic:
- API integration with timeout handling
- Data processing with error handling
- UI updates with DOM element caching
- Event handling with performance considerations
- Utility functions with input validation
- Efficient rendering methods
- Loading state management