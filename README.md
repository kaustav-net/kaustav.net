# kaustav.net

Personal tech blog built with [Hugo](https://gohugo.io/) and hosted on [GitHub Pages](https://pages.github.com/).

## Local Development

```bash
# Install Hugo (macOS)
brew install hugo

# Run dev server
hugo server -D

# Run dev server accessible from other devices on your local network
hugo server -D --bind 0.0.0.0 --baseURL http://$(ipconfig getifaddr en0):1313

# Build for production
hugo --minify
```

## Deployment

Pushes to `master` automatically build and deploy via GitHub Actions (`.github/workflows/deploy.yml`).

### GitHub Pages Setup

1. Go to **repo Settings → Pages**
2. Under **Build and deployment → Source**, select **GitHub Actions**
3. Push to `master` or manually trigger the workflow from the **Actions** tab

## Custom Domain

The site is served at [kaustav.net](https://kaustav.net).

### DNS Configuration

Add the following records in your domain registrar's DNS settings:

**A records (apex domain):**

| Type | Host | Value |
|------|------|-------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

**CNAME record (www subdomain):**

| Type | Host | Value |
|------|------|-------|
| CNAME | www | kaustav-net.github.io |

### Domain Verification

1. Go to [GitHub account settings → Pages](https://github.com/settings/pages)
2. Click **Add a domain** → enter `kaustav.net`
3. Add the TXT record GitHub provides to your DNS settings
4. Verify the domain on GitHub

### Custom Domain in Repo

1. Go to **repo Settings → Pages → Custom domain**
2. Enter `kaustav.net` and click **Save**
3. Enable **Enforce HTTPS** once DNS is verified

The `static/CNAME` file ensures the CNAME is included in every build.
