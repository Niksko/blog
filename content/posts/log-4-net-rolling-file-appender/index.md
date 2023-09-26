---
title: "Log4net rolling file appender with multiple projects"
date: 2017-04-03T23:12:23+11:00
draft: false
imageAlt: "The Apache log4net logo"
image: "log4net-logo.jpg"
categories:
  - technology
tags:
  - log4net
  - C#
---

The purpose of this article is to document a minor frustration I ran into at work a few weeks ago, in the hopes that somebody else with the same issue will stumble across it.
If I can save another poor soul some time, then it will be well worth writing this.
<!--more-->

At the moment we’re developing a large web application with an _almost_ micro-service architecture.
What this means is that we have multiple separate applications running on the same machine, and all of them need to produce log files.
We’re using [Apache log4net](https://logging.apache.org/log4net/) as our logging framework.

If you Google for sample rolling file appender configurations, what you might see is something like this ([taken from this StackOverflow question](https://stackoverflow.com/questions/1165084/log4net-rolling-daily-filename-with-date-in-the-file-name)):

{{< gist niksko 5de9f20ca39bfb9b55948ae9f6b907ee "web.config.xml" >}}

We’ve defined a log file appender that will create daily logs in the `logs\` directory with the date in the name of the log file.
This works fine for a single application logging to a file.

Now let’s say you want to include the name of the service that created the log in the logfile name, so that you can differentiate between different sources of log data.
Here’s how you might naively think to do this:

{{< gist niksko ae49d29af8440c155c46966f536faaaa "web.config.wrong.xml" >}}

This looks fine, and might appear to work at first.
In fact, it does work some of the time.
However as soon as you have multiple applications trying to log at the same time, you run into issues.
What this leads to is strange problems where a you will seem to get log output sometimes, but not other times.

The solution is quite simple.
You can’t simply change the `value` attribute of `datePattern`, you have to change the `file` node’s `value` as well:

{{< gist niksko 0b6ceab982b855dd6c9ffd5687f64b2e "web.config.right.xml" >}}

Problem solved!
You’ll now get log output from all of your applications, even if they output log data at almost the same instant.

The issue with the naive approach is that even though your files will in theory have different names, log4net appears to lock the entire logs folder (even with the locking model set to minimal), which prevents the creation of or appending to the other log files.
The solution is to force log4net to only lock the specific file that will be used by each application, thus allowing each application to lock its own logfile and write to it without interfering with the others.
