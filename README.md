# kaustav.net

Personal tech blog built with [Hugo](https://gohugo.io/) and hosted on [GitHub Pages](https://pages.github.com/).

## Local Development

```bash
# Install Hugo (macOS)
brew install hugo

# Run dev server
hugo server -D

# Build for production
hugo --minify
```

## Deployment

Pushes to `master` automatically build and deploy via GitHub Actions.

## Custom Domain

The site is served at [kaustav.net](https://kaustav.net). DNS should have an A record or CNAME pointing to GitHub Pages.
