---
title: "Skouf Dot Com Redesign"
date: 2022-04-16T04:31:25Z
draft: true
---

If there's one thing I've learned when it comes to personal projects over the last few years, it's that my interest in
them is _extremely_ bursty.
I'll spend a few weekends hacking on something, get it to a point that it works, and then not touch it again for
roughly 12 months.
This presents a few suggestions for what to optimise for when I'm creating a personal project:

1. The docs should be excellent. Thankfully, this isn't something out of the ordinary, and if anything, creating 
   personal projects in the past that are documented terribly has encouraged me to internalise and practice writing
   great docs. The code that builds and deploys these docs is probably a good example of that. I've managed to come
   back to it now a few times, and creating new entries, building and deploying has been easy and simple each time.
1. Simplicity is a virtue. The biggest example of this was probably my convoluted Matchbox/Ignition/PXE boot Kubernetes
   setup that I detailed in my [IAC in the home]({{< ref "posts/iac-in-the-home/index" >}}) article. A year on,
   I couldn't remember how any of it worked and had to start from scratch. This is also probably tied to good docs, but
   complexity also introduces additional things that can (and will) break. Complexity is not durable.
1. The world will move on. Nothing really to hedge against here. What was state-of-the-art 12 months ago likely isn't
   state-of-the-art now. Rewrites are inevitable. Use them as an opportunity to catch up to the zeitgeist.
   
Looking at those three points, they're probably true of _any_ project rather than just personal projects. 
Who knew?

When I was young and naive, I built a website for myself by cobbling together a design I found, some custom css, and
manually hacking in some features I liked.
It sort of worked on mobile, but not that well.
It was hard to update, kind of ugly (in hindsight), and not really conducive to maintenance and updates.
The content on there, the things it shows off, are dated and not really reflective of the engineer that I've grown to
be, or the interests I have.
They're a reflection of me, fresh out of uni, with some (again, in hindsight) frankly terrible toy projects that I'd
be kind of horrified to show prospective employers or even colleagues.

Another thing that's apparent is that the website isn't fit for purpose any more.
When I built it, it was a toy.
I got to play around with some fun tech.
And I got to show off to people, because in my social and uni circles at the time, having your own domain and a website
was somewhat novel.
At this point it's probably more of an embarrassment than something I'd want to show off to colleagues, and friends are
more likely to want to see blog entries rather than anything that's on skouf.com.

With all of that in mind, it was time for a re-write, with a few goals:

* Build with the learnings above about documentation, simplicity, and the pace of the industry in mind.
* Build in a way that it can be updated easily, to account for growth as an engineer and a person.
* Build for the audiences I care about, and make it easy for them to get their jobs done.
* Build the website itself in such a way that I learn from it, because my frontend skills are pretty rusty.
* Build so that the site itself is a project I'm proud of.

With those goals in mind, off we go!

## Design thinking

Lately [at work](https://www.seek.com.au/work-for-seek/life-at-seek/) I've been doing a bunch of product thinking, and
iterating on how we go from rough ideas and a product-shaped hole to delivering specific outcomes that meet customer
needs.
A tool I've been reaching for is [design thinking](https://en.wikipedia.org/wiki/Design_thinking), and specifically,
the [design thinking double diamond](https://www.designcouncil.org.uk/news-opinion/double-diamond-universally-accepted-depiction-design-process)
approach to designing software and products.
I was introduced to this methodology primarily through Hackathons, and I've been pretty happy with the sorts of
results it produces.
I like that it's not terribly prescriptive, meaning that it's flexible and can be adapted to lots of different types
of design problems.
It's also iterative in nature, and iteration leads to better design.

There are probably as many techniques for doing design thinking as there are frontend frameworks.
Choosing one can lead to decision paralysis.
Instead, I think it's more important to just have some sort of process, regardless of whether it's the 'right' process.
It's the act of thinking about the design of whatever you're building that nudges you towards better choices, not
the specific steps that you take.

## Persona mapping

Something I've enjoyed in the past to kick-start the 'Discover' phase of design thinking is [persona mapping](https://www.interaction-design.org/literature/article/personas-why-and-how-you-should-use-them).
I think what appeals to me is an 'extremist' style of personas, that helps you understand the extremes of the audiences
you are designing for.
Once you've explored the extremes of the solution space, you're better equipped to understand what 'too far' towards
and extreme looks like.
Hopefully, this leads you to make better and more informed decisions about the tradeoffs required to please all of your
potential audiences.

With that in mind, here are the personas I came up with for my site:

< Insert images of personas here >

There are definitely some themes here, but I think the best way to represent the ideas that it generated for me are
through the 'Discover' phase of the design thinking double diamond.
To make sure that I accurately represented each of my personas, I used the following method:
1. Read one of the personas, trying to really internalise their feelings and thoughts.
1. Spend 4 minutes brainstorming, trying to empathise with that persona
1. Read the other persona, and repeat
1. Finally, spend 4 minutes brainstorming without a persona, to see what else you can capture

Here is what I came up with:

< discover step image >

After this, I did some grouping into themes or ideas over in the 'Define' section.
Here's where I ended up:

< define step image >

## Broad design principles

At this point, I feel like I'm starting to get a bit of a feel for how I'm going to design this website.

To fill in some required detail here, I have a site at `skouf.com` which I figure is going to be the entry-point for
lots of folks.
It's easy to just point people there are be done with it.
However I also have a blog at `blog.skouf.com` which is a separate Hugo-based static site.

With that context, some of the information below points clearly to things that need to be on the main `skouf.com` site.
This includes stuff like contact details, signposting stuff, probably employment things, and a bio.
There's also things that are likely enhancements to the blog, but that may also warrant their own place on the main
`skouf.com` site, likely as links off to `blog.skouf.com`.

Here are some of the broad themes that will shape this re-design.

### Two clear 'types' of users

It seems pretty clear to me that there are two clear 'types' of users of my site:

* People looking to hire me for work
* People looking for content that I've created

These two groups have some shared needs, but also have pretty different interaction patterns.

The people looking to hire me want to make a decision about whether I'm worth their time to get in touch with, or to
progress to the next round of a hiring process.
They need a bunch of things from me to do this, and they need to do it fast, because they're busy and I'm just
another candidate in a sea of developers.
I need to stand out, but also, want to make their lives easy.
This points to big, easy to find links to the stuff they want: resume, bio, contact info, what I'm looking for in a job.

The other people are either friends and family looking for food stuff, or general internet denizens looking for food
or tech info.
These people have a different interaction mode.
They're either looking for a specific thing because they've heard me mention it.
Or they're looking for information organised around a topic: either more of the same, or more by me on a slightly
different topic.

Given the large difference in these interaction modes, I'm thinking about implementing something that I've seen in the
past and enjoyed: the explicit 'switch' to accommodate the two different types of users.
This takes the form of some sort of literal 'switch' UI element on the page, that changes the content and look-and-feel
of the site depending on what the user selects.
This is a fun way to separate the two different types of users.
It provides a fun technical challenge (theming the site), as well as twice the opportunity to exercise my creativity
in designing and laying out a website, while simultaneously optimising the experience for two quite different use cases.

### Topics of information are key, along with recency

In particular, the friend/family/internet denizen use case likely wants to browse content by topic.
These topics are probably somewhat varied, and run the gamut of being organized by subject, to being organized by
intended audience.
At this stage, topics should probably be along the lines of:

* Food
* Drinks
* Accessible tech stuff
* Kubernetes
* Product and design
* People and organisations

Some of these topics are aspirational: they're things I spend time thinking about, but haven't written much about.
This need for topics also underscores the need for my blog to get a bit more sophisticated.
These topics should largely be driven from the blog, and skouf.com should just link to the blog topic pages.

### The recipes probably need more sophistication

A theme is that if I'm a friend or family member looking to recreate things, I would probably have the same wants and
needs that I personally have out of recipes.
Namely:

* Where do I find this obscure ingredient?
* What are recipes like this one?
* What drinks pair well with this food (or visa versa)?
* How do I share this to friends?
* (Not something I subscribe to, but I know lots of people do) Can I skip the preamble and get straight to the recipe?

That last one is painful, but I know that's what people want.
I should probably give it to them.