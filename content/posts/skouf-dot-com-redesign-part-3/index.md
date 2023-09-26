---
title: "Skouf.com redesign - part 3"
date: 2023-09-25T08:25:42Z
draft: false
summary: "In the final part of my website redesign, I finish things off and simplify by merging my blog with my website, inspired by striving to be simple and other personal sites I've come across in the last year or so"
categories:
  - technology
tags:
  - website
---

_Read [part 1]({{< ref "posts/skouf-dot-com-redesign-part-1/index" >}}) and [part 2]({{< ref "posts/skouf-dot-com-redesign-part-2/index" >}})
of this series_

It's been a long time between drinks, but I've finally gotten around to completing a redesign of my website!
But not only that, I've also redesigned this very blog!
In this post I'll finally wrap up my series on my redesign, and explain where I ended up and why.

## Further inspiration

[Last time]({{< ref "posts/skouf-dot-com-redesign-part-2/index" >}}), my inspiration came from
[michellehertzfeld.com](https://michellehertzfeld.com/).
As a brief recap, after overcooking things a little and being a little too grandiose about who might be visiting my
website in [the first part of my redesign]({{< ref "posts/skouf-dot-com-redesign-part-1/index" >}}), I sensibly
decided not to have a giant 'lever' on my website to switch between personas of potential readers.
Instead, I liked Michelle's pretty simple explanation of what they did, and where to find them.

In the intervening time between then and now, I also came across [sunshowers.io](https://sunshowers.io/), the
website of Rain.
This seemed like almost exactly what I wanted to have on my website.
A little bit about myself, a few links depending on what the reader was interested in, and then content.
Crucially, I decided that having my website on a domain and then my blog on a separate domain didn't really make sense.
The website is basically just a landing page for the blog, so I'll just put them together.
This also means moving my blog from `blog.skouf.com` over to just `skouf.com`.

Simpler is better, and this simplification leaves me with fewer domains to worry about, and hopefully ends up being
more cohesive.

## Tech choices

I've gotten sick of the mess of Node versions and Docker containers that I've gone with in the past.
This project is now entirely built with Tailwind and Hugo, and I'm using the binaries.
In _theory_ I'll add some Nix config (blog post on that soon), but also downloading two binaries (really just one as
long as I'm not making theme changes) really isn't that onerous, and is basically foolproof.

Tailwind has proven to be a really nice framework to use, and has resulted in much less CSS for this site, as well
as styles that I now actually understand and can confidently make changes on.

I'm still using Cloudflare for CDN and DNS, though I would like to use something else.
However it was pretty easy to set up a dynamic redirect to allow any existing `blog.skouf.com` links to redirect to
plain `www.skouf.com` links.

## Wrapping up

That's largely all there is to say.
I think the result in the end is pretty great looking, and the code is all finally my own instead of including
random bits of CSS and Hugo templating from around the place.

I'm not totally done, but everything is in a much better place.
And crucially, my old and extremely ugly website is no more!

A very quick TODO list:

* Create some section pages for different topics.
  A while ago I added a 'tags' taxonomy to this site, but I haven't made use of it yet.
  This should let me have a landing page just for 'food' articles, or just for 'tech' articles and whatnot
* Redo the syntax highlighting.
  The theme it uses right now is ugly, I think I can do much better on this.
* For the rare image that a user might want to zoom in to, tapping should bring up the full size image.
