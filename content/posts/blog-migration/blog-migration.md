---
title: "Blog migration"
date: 2020-04-08T02:30:18Z
draft: false
summary: It's finally time to take my blog off of Medium and host it myself.
description: "Moving my blog from Medium to Hugo"
---
## Growing tired of Medium

This has been a while coming.
To be frank, I'm sick of Medium as a content platform.

I resent the annoying full-page popups asking you to sign in.
I'm sick of these as a reader of other publications, and I'd be horrified if my readers were ever subject to them.
To add to their annoyance, I noticed a bizarre and infuriating dark pattern the other day.
Dismissing the 'you have four articles left this month' popover caused an un-dismissable signup screen to be displayed.
If you just ignore the popup, you can read the article.
Not cool.

Aside from corporate greed, Medium isn't really built for the sort of content I tend to write.
Up until now, I've largely blogged about technical subjects.
This means lots of code snippets, which aren't as easy to integrate into Medium as I'd like.
There's no native code formatting, so I have to embed Github gists.
They work fine, but it's annoying and much more tedious than just writing code snippets inline.

## The new blog

The new blog hosting platform needed a few things:

* As discussed above, I wanted better support for code blocks.
* I wanted more control over the design and layout of the blog, down to writing custom CSS, JS and HTML.
  This is partly for controlling the styling, so that things look pretty and consistent.
  But it also affords me the option of doing more interesting posts with, for example, embedded Javascript, custom CSS, and even more exotic things.
* This should be a given, but it needs to be responsive and look good on mobile.
* Tagged content, or some sort of post taxonomy.
  Up until now I've written about tech stuff.
  I have a bunch of other interests that I might like to write about, and I think it would be nice to be able to filter posts by topic or tag.
* The ability to be hosted for free.
  I managed to get on to Medium with a custom domain before they started charging for it.
  I'd like to keep it that way.

In the end I settled on [Hugo](https://gohugo.io/).
It ticked all of the points from above, as well as the following niceties:

* Hugo is widely used, which means there's lots of tutorials and Stackoverflow articles.
  Invaluable when you're getting your head around a new framework.
* Hugo is _very_ powerful.
  Part of what steered me in the direction of Hugo was contributing to [the docs for the Istio project](https://istio.io/).
  These docs look great, and look nothing like a simple blog.
  They also have great customizations like the code block that allows you to copy directly and change theme.
  These are all testaments to Hugo's power.
* Hugo has a large library of themes, which serve as really good starting points for customization.
  I'm not really a front-end dev, so having a starting point cuts down on my frustration.
  I'm a lot more adept at taking an existing stylesheet and tweaking it where I don't like it, which is what I ended up doing.

## The migration process

Migrating the content was fairly easy.
Hugo content is written in markdown, so getting all of the content over was as simply as copy-pasting text and downloading images.
Figuring out how to store my images alongside my markdown proved a little challenging, but in the end the key was to use `index.md` files, which cause Hugo to treat images at the same level as part of a [Page Bundle](https://gohugo.io/content-management/page-bundles/).

The harder part of the migration was setting up Hugo and modifying the theme.
I picked the [Hestia pure](https://themes.gohugo.io/hestia-pure/) theme to base my modifications on.
It presented a clean and minimal look, and had most of the features I needed.
A few licks of green paint, and many many tweaks to the CSS and the templates and I was up and running.

At some point I should probably do a complete rewrite, as the CSS is ugly.
It mixes bootstrap style BEM classes with my custom media queries that I spatter around the place, but for the moment, it will do.

Finally, it was a matter of switching off the Medium blog and shifting the DNS over to Github pages.
In a final screw-you, it was confusing and difficult to figure out how to disable the Medium blog.
In the end, 'deleting' the 'publication' was the right move.
Apparently deactivating my account wasn't enough.
Thankfully, all that's needed to get a custom domain to work with Github pages is to point a `CNAME` record at `<your-username>.github.io`.

## Future work

As of now, the blog is up and running.
However there's still some work I'd like to do in the future:

* Optimizing images.
  At the moment I'm not doing any image processing or optimization.
  Image heavy pages are likely slow to load.
  In the future I'd like to set up automation to generate multiple image sizes and serve them to different clients.
  Even fancier would be using the [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) to only load images once the user scrolls their viewport down.
* The publishing flow needs a little work.
  If you [check out the repo behind this blog](https://github.com/Niksko/blog), you'll see that I've got some docker-compose services for portability and convenience.
  However it's still a little cumbersome to have to run the right ones at the right times, and to remember to run them before pushing.
  Ideally I would have a pre-push hook that regenerates the theme as well as the site, and then makes sure there are no changes.
  This would ensure that before pushing on master, the page has been regenerated.
  This is probably the first thing I'll tackle.
* The dev workflow also needs some work.
  A single script to start up the local Hugo server, as well as the Gulp watcher, would speed up the authoring and dev workflows.
* The stuff in the template I neglected to change...
  I think are a few pages that I didn't get around to spruicing up.
  The 404 page comes to mind.
* The tags/taxonomies.
  I mentioned this as a goal above, and it's easily doable with Hugo.
  I just don't have any non-tech articles yet, so it's not a high priority.
  It needs some styling of the pages that list the articles (I think), which is why I've put it off.

Hopefully despite all of those changes, you like the look of the new blog!
If you notice any glaring issues, let me know via the social media links below.
