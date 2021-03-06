# blog.skouf.com

## Basic tasks

To run Hugo commands:

```
$ docker-compose run hugo <your command>
```

To run a local, live-reloading version of the site

```
$ docker-compose up local
```

Posts are best set up if we use leaf page bundles, with images alongside markdown.
To create a new post of this type:

```
# Create a directory
$ mkdir content/posts/<post-name>
# Create the post page
$ docker-compose run hugo new posts/<post-name>/index.md
```

To rebuild the bundled `skouf` theme

```
$ docker-compose run build-theme
```

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

## Deployment

Build the site to the `/docs` directory with `docker-compose run hugo`.

Github is configured to serve this as a page out of the `/docs` directory on the `master`.
Pushing to `master` will update the live site.
