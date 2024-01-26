---
title: "My system for managing my notes"
date: 2024-01-26T01:30:18Z
draft: false
image: notes.jpg
summary: "How I manage my personal notes for maximum access and minimal data loss"
description: "How I manage my personal notes for maximum access and minimal data loss"
categories:
  - technology
tags:
  - notes
  - web-technology
  - AWS
---

{{< figure src="notes.jpg" caption="Photo by [Jan Kahánek](https://unsplash.com/@runfilm) on [Unsplash](https://unsplash.com)" alt="A shallow focus image of a notebook with a pencil on it.">}}

This blog post serves as an overview of how I manage my personal notes.
I delve a little into my preferences for notes and note taking software,
discuss how I manage the data that underlies these notes for high-availability,
and also jot down a few brief things that I'd like to fix in the future.

I mainly wrote this to make it easier for me to remember how this is all set up
for when I inevitably forget in the future.
Over the years (as I've noted in my other blog posts), I've found it incredibly
useful to have detailed records of how everything in my home tech setup works.
Given how infrequently I tend to tinker with and maintain these systems, it's very easy
to come back to a broken system or a no-longer fit for purpose system after a few years
and be very puzzled as to how everything fits together.
I've used my own blog posts as a reference a few times now, and I hope that this
will be a reference for me in the future.

## Migrating note systems

In the middle of 2023, I migrated my years worth of notes out of Google Keep, and into Obsidian.
At that point in time I must have been the last person on Earth to figure out how cool
Obsidian is, but I got there eventually.

For the two people out there who don't know what [Obsidian](https://obsidian.md) is,
it's a note taking app with a few key features that make it great for both more casual
note takers (of which I _kind of_ am) and true note taking nerds (you might not have
expected that there was such a thing as a note-taking nerd, but there's a subculture
for everything).

Obsidian stores everything as Markdown files in standard directories.
This is big draw card because it means that to some extent (modulo a few Obsidian specific
bits of syntax), your notes are effectively eternal.
Markdown has been common enough and has gone unchanged enough for long enough that
I think it's fairly safe to say that even in 50-100 years we'll still have applications
that can read and write Markdown.
And even if for some reason Markdown falls out of fashion, text files will not,
and one of the [design goals of Markdown](https://daringfireball.net/projects/markdown/)
is that Markdown documents should be readable as text files without any additional rendering.
That's all a long-winded way of saying that I can feel comfortable that the notes that I
take in Obsidian will be around for a long time.

Obsidian's other big feature is how it organises notes.
As with most things Obsidian, you definitely have flexibility in how you accomplish this.
But for me:

* folders to split notes based on subject
* links between notes to allow for referencing other notes and not repeating myself, and
* the ability to have multiple 'vaults' to completely separate (for me) my food and drink notes
  from my other general notes

are the organisational features that I really need.

Obsidian has a million-and-one other features, a rich plugin ecosystem, and even some first-party
hosted services (notes sync and public note hosting) which also contribute to it being
everyone's favourite note-taking application.
Oh, and did I mention that they [are 100% user funded, want to remain a small team, and have no outside investors](https://obsidian.md/about)?
Legendary!

The migration took me a few days of methodically going through a JSON export of
all of my Google Keep notes, tidying them up and sorting them into Obsidian.
That time was well worth it, and I now both take more notes and reference my notes more
often because they're much easier to find and use.

## Syncing notes

One thing that is ubiquitous these days is cloud-syncing of data.
This makes it very convenient to access notes in Google Keep across devices
(like between my laptop and my phone), and was a draw-card of Google Keep in the
first place.

As I mentioned above, Obsidian offer a paid sync service.
For now, I've chosen not to use it.
I have a natural aversion (perhaps, irrationally) to ongoing fees, so thus far I've
opted for more of a home-rolled solution that relies on my own hardware.
So-far so-good, though Obsidian's great ethos and user-funded model definitely
would lower the barrier to me using their native sync service in the future if
I decided I didn't like my home-grown solution.

My home-grown solution is simply [Syncthing](https://syncthing.net/).
Syncthing is a peer-to-peer file synchronization daemon that also conveniently
runs anywhere you'd need it to.
You point it at a folder on your filesystem and then share that folder to other
devices, and every device uses a relay server and an encrypted connection to
synchronize the files in each folder between devices.

I have Syncthing set up on my Pixel, on my Linux desktop, and on my TrueNAS server,
and the plain files and folders that make up my Obsidian vaults are streamed between
them to ensure that everything stays in sync.
I've noticed zero lag in replication, and had zero troubles with this setup from the day
I set it up eight months ago.

My only word of warning: check your list of relay servers carefully before using
Syncthing on corporate networks.
It seems that the default list of relay servers includes some Tor exit nodes and
some other probably-innocuous (given Syncthing's security model) servers that
are likely to set off alarm bells within your organisations security operations
centre.
I think these can be disabled in favor of more reputable relays (at the expense of
lower availability), but I just opted to remove Syncthing from my work device.

## Backing up my notes

The other benefit of using a hosted synchronization service is that you likely
get backups of your notes for free.
Most cloud service will offer you the ability to restore notes or to otherwise
contact support if your notes go missing.
By home-rolling my sync setup, I don't get these niceties.

Instead, I decided to use my standard backup location: S3 Glacier Deep Archive.
Storage costs are miniscule.
They amount to a few USD per month, and 99% of that cost are backups of my holiday
photos rather than the 40Mb of notes I've got (much of which are photos for
reference so that I can coach my Grandma through fixing her TV over the phone).

The other benefit of S3 is that it's ubiquitous, which means that my TrueNAS home
server supports backing up to S3.
This is how the backups are actually accomplished.
Nightly, there is a job that snapshots the folder that Syncthing syncs to on the
server and sends it to S3.
I've used versioned buckets in S3 so that I can go backwards in time and retrieve
old versions of notes if need be, which is another useful feature.

So far the growth of these notes has been pretty modest, as you can see in the
following graph:

{{< figure src="s3-growth.png" caption="Growth of my notes S3 storage and object count over the last 8 months" alt="A graph showing the growth of the number of objects and the total size of the objects in mb over the last 8 months. The object count has grown steadily from less than 200 objects to around 1500 objects, and the total size has grown from 0 to almost 40Mb, most of that growth in the first few months." >}}

## The first acid-test of my backups - a success!

If you don't regularly test restoring from your backups, you don't really have any backups.
So the old saying goes.
My impetus to write this blog post was a situation that required some restoration, so that I
could jot down the process for posterity.

At some point in the past few months, I used Android's 'file cleanup' feature to make some
space on my phone.
It seems that this inadvertently cleaned up some photos that I had taken and attached to some
of my Obsidian notes.
This was probably just due to my inattention to what was being cleaned up, but if you're reading
this Android team, a 'don't every clean up files in this directory' option would be much
appreciated!

The restoration process was very simple:

1. Locate the files in S3 using the AWS web console.
   This requires using the 'Show versions' toggle, since what I wanted to view
   were old versions of files.
1. Since these files have been deleted, we want to, ironically, delete the
   'deletion markers' that S3 uses to track that the files once existed but are
   now deleted.
   This should effectively 'un-delete' these files.
1. Initiate the restoration process of the files, again by clicking through the AWS
   console.
   This takes about 12 hours on average for Glacier Deep Archive, and costs cents
   for what turned out to be 5 small jpegs.
1. Once the restoration has completed (you'll see a status message at the top of the
   file details page), you can download the files and put them in the right place
   on the filesystem.

Everything back how it should be!

## Still TODO

While I'm quite happy with my current setup, there are a few more tweaks that
I'd like to make in the near future.

Firstly, my backups are not resilient to my server being off, since this is
where the nightly backups are performed.
I have a tendency to turn my server off when I don't use it for a while,
and it would be nice to have one of:

- A scheduled power on, do backups, power back off cycle e.g. once per week
- A reminder when my backups haven't been executed in a while.
  Perhaps something triggered out of S3 when no changes have been made to my
  note backup bucket for over a week?
- A backup method that works from my phone, which is the device that you can
  rely upon being online most often.

Secondly, given that I now have a nice Markdown note-taking system on my phone,
and this blog is also written in Markdown...
Perhaps it would be nice to be able to author and publish blog posts from my
phone?
The thinking here is that it would greatly lower the barrier to entry for
authoring blog posts, and hence, I might blog a bit more often.
At the moment I do my blog-post authoring on my laptop, and the thought of
getting up off the couch, going to my office and grabbing my laptop is usually
enough for me to not bother.
Or alternatively, for me to jot down some ideas in an Obsidian folder I have
called 'blog ideas', and then never publish those ideas.

This would require me to set up some proper CI for my blog which I've neglected
to do, but shouldn't be too hard to set up with GitHub actions.
It would also require a way of sending my notes from Obsidian over to the
GitHub repo that hosts this blog.
However as with everything Obsidian,
[there's a plugin for that](https://github.com/denolehov/obsidian-git).
And in fact, there's perhaps an argument that backing up my notes to GitHub
might even be a better way of doing backups than S3.
