---
title: "Skouf.com redesign - part 2"
date: 2022-04-18T08:25:42Z
draft: false
summary: "In the second part of my website redesign, I think a bit about technology choices and design, and then end up stopping abruptly for a year and half"
---

_Read [part 1]({{< ref "posts/skouf-dot-com-redesign-part-1/index" >}}) of this series_

In the previous installation of this series, I talked about some of my motivations for redesigning my website, and
outlined a small bit of design thinking that I did to try and arrive at some of the key elements of a new
[skouf.com](https://skouf.com).

This part will outline setting up the foundations to build a new [skouf.com](https://skouf.com), and some of the
decision making process for the tooling and technology I'm choosing.

## Technology choice

Where possible, I try and avoid running servers.
For something like this, where I expect to not touch it frequently (because my work on personal projects is highly
bursty in nature), I don't want the hassle of servers to maintain or patch, and the potential for vulnerabilities.
This means I'm going to be building a static site of some sort.

My first inclination was to use [Hugo](https://gohugo.io/).
I use Hugo for this site, and it works well.
It's also incredibly flexible.
Last I checked, the [Istio docs](https://istio.io/latest/docs/) used Hugo, and that site is very highly customized.
If Hugo can support something like that, it can support basically anything that I need.

The other big consideration for me when setting up a site is how I'm going to get it looking the way that I want.
I'm not a frontend developer or designer by any means, and one of the things I've found with previous projects is that
simply writing CSS by hand is something I can do, but that I'm not particularly good at.
What I create works, and looks fine, but what I lack are the design fundamentals that make it look great.
It's incredibly frustrating, because I can _see_ that things are slightly off, but I really don't know what to do to
make it better.
Basically, my strategy towards CSS is 'keep tweaking until it looks right', when it seems like my strategy should be
more along the lines of 'define some rules up front, and apply them to everything'.

So with my lack of design skills out in the open, it seems like a sensible choice to make would be to use a CSS
framework, to try and add some structure and order into my theming.
The hot CSS framework at the moment is [Tailwind CSS](https://tailwindcss.com/), but this immediately presents a
problem.
Googling "tailwind css hugo static site" pops up a number of forum posts and GitHub issues that seem to indicate that
Hugo and Tailwind CSS version 3 don't play nice together.

Out of the CSS framework and a static site generator, if I can only pick one, at this stage I'm going to pick the CSS
framework.
After all, Hugo is primarily helping me render my content into HTML, and if I expect [skouf.com](https://skouf.com) to
have relatively little content, then perhaps Hugo isn't getting me that much?

This begs the question: can I build a static site that behaves how I want, without using a framework like Hugo?
We will find out.

## Design

In my last post, I had sort of decided on this switch-flip/mode change between friends and family and recruiter mode.
I'm not sure why I like this idea, but as I was coming up with how the UX would work, I quickly decided it was a bad
idea.
I _think_ the idea of that sort of interactivity comes from this wonderful website: https://getcoleman.com/.
Please take a sec to check it out and play with the slider, it's really a work of genius.
What works incredibly well for that site is that the interactivity _is_ the pitch.
I think my notion of using interactivity to 'switch' between clients is a totally different use of the interactivity,
and therefore, really needs to have a good reason for being there.
The conclusion I came to is that without the interactivity really being a 'feature' (it's not that interesting, every
site has a light and dark mode these days, and I'm not especially talented at design that the switch and two different
modes would be either good or useful), then the cons (poor UX, needs to be learned, needs to balance screen real estate
with usability, how do you figure out what to default to?) outweight the pros.
I did briefly consider making the 'switch' a drawcard, by trying to do some sort of machine learning to figure out
who to default to, but a) that's not my area of expertise, b) I can always add it later c) it sounds pretty hard, there
might not be anywhere near enough info without resorting to nefarious tracking and d) it's probably privacy invasive,
and I don't want to send that message.

Fortuitously, I was browsing around looking at other people's personal sites, and stumbled across one I quite liked.
https://michellehertzfeld.com/.
Aside from quite liking the design, for whatever reason it struck me that this design, namely:
* A greeting
* Brief blurb
* What I do
* Contact
* The about the site section

is basically what I want to show the recruiter persona.
Taking that design as a starting point, what I'd like to change is:

* The about the site is perhaps too prominent, though I'm not averse to it.
  The fact that I'm hosting on GitHub and using Tailwind might be interesting to some.
  My typography choices likely less so, and without that second section, it feels a little un-interesting.
* The links at the top of the page are good, but I'd also want to send people in a slightly more curated direction
  from the homepage.

I'd like my site to have a bit more of a 'call to action', that encourages the type of behaviour I'm expecting from
people.
Effectively, this serves as my 'switch'.
You self select what 'call to action' you'd most like to listen to, and that
takes you to where you're going to be best served.
Will need to be sure that I don't dilute the calls to action too much by having too many, so 3 is probably the max.

## Meta: A long hiatus

I jotted down everything you see above shortly after writing the [previous part of this series]({{< ref "posts/skouf-dot-com-redesign-part-1/index" >}})
and then life got in the way.
This is just a quick note to explain why this post ends kind of abruptly.

_Read [part 3]({{< ref "posts/skouf-dot-com-redesign-part-3/index" >}}) of this series for the thrilling conclusion_
