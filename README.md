# blog.skouf.com

## TODO

- [ ] Do a pass for accessibility
- [ ] Make the rendering of code blocks much prettier as well as responsive, it's pretty ugly right now
- [ ] Allow images to zoom which clicked or tapped in a sort of lightbox thingo
- [ ] Create a landing page that will serve as the new homepage of skouf.com
- [ ] Figure out how I can redirect blog.skouf.com URLs to `skouf.com/blog/<original path>`

## Setup

Download the Hugo extended binary from the Hugo release page.

Latest working version is: [Hugo extended v0.118.2](https://github.com/gohugoio/hugo/releases/tag/v0.118.2)

## Basic tasks

To run a local, live-reloading version of the site

```
$ hugo server --buildDrafts --config config.toml,debug-config.toml
```

Posts are best set up if we use leaf page bundles, with images alongside markdown.
To create a new post of this type:

```
# Create a directory
$ mkdir content/posts/<post-name>
# Create the post page
$ hugo new posts/<post-name>/index.md
```

## Deployment

Build the site to the `/docs` directory with `hugo`.

GitHub is configured to serve this as a page out of the `/docs` directory on the `master`.
Pushing to `master` will update the live site.

## Writing posts

### Post preview images

Use the `image` field in the frontmatter to add a preview image.
Image paths are relative to the markdown file.

### Post summaries

Post summaries will use the first N words of the post, unless you make it otherwise.

If you want the summary to be the start of the article, you can control the truncation by placing a `<!--more-->` tag in the article.

Use the `summary` field in the frontmatter to set the summary to something other than the start of the article.

### Images within posts

Use the `figure` shortcode.
This will automatically resize images to a few sizes, and serve them up depending on the size of the image.

Example:

```
{{< figure src="<relative-path-to-image>" caption="Some image caption" alt="Alt text" >}}
```

### Recipes

There are three shortcodes that can be used to format a post as a recipe.
They are intended to be used in a nested fashion.

Example:

```
{{< recipe name="Name of the recip" total-time="Total recipe time" active-time="Active recipe time" yield="(optional) yield of recipe" credit="(optional) credit for recipe">}}
  {{% ingredients %}} // Note the {{% %}} delimiters to ensure that the content is rendered as markdown
  * First ingredient
  * Second ingredient
  {{% /ingredients %}}
  {{% method %}} // Also using {{% %}} delimiters here for markdown
  Method here
  {{% /method %}}
{{< /recipe >}
```

### Code blocks

Code highlighting is enabled on code fences.
We currently use a stylesheet embedded into the theme for our highlighting, see the stylesheet in question for details.

## Theming

### Setup

This repo uses the Tailwind CLI as part of theme generation.
You can install this as a [standalone binary](https://tailwindcss.com/blog/standalone-cli).

```
curl -sLO https://github.com/tailwindlabs/tailwindcss/releases/download/v3.3.3/tailwindcss-macos-arm64
chmod +x tailwindcss-macos-arm64
mv tailwindcss-macos-arm64 tailwindcss
```

Adjust the OS and arch above as appropriate.

### Making changes to the theme

Updates should be made to the Hugo templates under the [`themes/skouf/layouts`](themes/skouf/layouts) directory, or
to static images under the [`themes/skouf/static/image`](themes/skouf/static/image) directory.

Once changes have been made, you can regenerate the TailwindCSS stylesheet with:

```
./tailwindcss --config themes/skouf/tailwind.config.js --input themes/skouf/src/input.css --output themes/skouf/static/css/style.css --minify
```
