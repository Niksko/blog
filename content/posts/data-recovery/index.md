---
title: "Recovering data from a failed drive using ddrescue"
date: 2023-12-06T02:09:52Z
draft: false
image: "hard-drive.jpg"
imageAlt: "An image of a bare hard drive platter with the head and disk exposed."
categories:
  - technology
tags:
  - data-recovery
  - homelab
---

My first foray into data recovery has been both educational and, blissfully, not too stressful.
You always hear tales of damaged hard drives and complete data loss and think "that'll never happen to me".
Well, it finally has happened to me, and thankfully the outcome has been pretty good (all things considered), and I've
learned a bit along the way.
<!--more-->

{{< figure src="hard-drive.jpg" caption="Photo by [benjamin lehman](https://unsplash.com/@benjaminlehman) on [Unsplash](https://unsplash.com/photos/black-and-silver-turntable-on-brown-wooden-table-GNyjCePVRs8)." alt="An image of a bare hard drive platter with the head and disk exposed." >}}

# Background

The hard drive in question is really old.
Like, 15 or so years old.
I think it was the original hard drive I bought when I built my first computer that wasn't from scrounged parts from
hand-me-down business PCs that my parents had gotten for cheap from their workplaces.
At the time, 1TB seemed like a huge amount of storage, so that's what I got for my limited student budget.

If I remember correctly, this hard drive has actually been failing for a very long time, basically since I got it.
Very early on there was a single remapped sector, but the consensus on the Internet seemed to be that a single bad sector
that remained as the only bad sector for a long time shouldn't be much of a reason for concern.
If the problem wasn't getting worse (i.e. more bad sectors over time), then I had simply gotten unlucky, but the problem
wasn't indicative of an imminent failure.
Eventually though, hard drives reach old age.

I got quite lucky this time, as this hard drive had clearly been failing for some time (a year or more?) without degrading particularly much.
The symptoms should have been obvious in hindsight, but I was looking in the wrong place.
When copying files off of an SD card to do backups, the backups were sometimes slow to complete, and seemed to have I/O errors.
Similarly, when backing those files up to S3, the transfer would often grind to a halt, or at least go extremely slowly, and also show I/O errors.
I'm not sure why I ignored the file copy issues.
But the S3 upload I attributed to the AWS CLI being slow, since others seemed to have similar problems.

Eventually though, perhaps based on some googling of the issue, I checked the SMART status and saw the signs of failure
in a huge number of read errors, and various other signs of wear and tear.
At this point I figured a new drive and some data recovery was in order.

# Using `ddrescue` to recover data

[GNU `ddrescue`](https://www.gnu.org/software/ddrescue/) is a nice little utility which claims to have a special algorithm
that will improve the chances of recovering data and minimizes wear on the drive.
I'll leave the veracity of that to the experts, but it was fairly easy to use and seems to have worked well.

The command below is what I used to perform the recovery.
The `-r3` flag says to retry bad sectors up to 3 times before giving up.
Importantly, you want to pass that third positional argument to generate a logfile, which means you can resume recovery.

```
$ sudo ddrescue -d -r3 /dev/sda /mnt/new-storage/sda-backup.img /mnt/new-storage/sda-backup.logfile
GNU ddrescue 1.27
Press Ctrl-C to interrupt
Initial status (read from mapfile)
rescued: 4176 MB, tried: 196608 B, bad-sector: 0 B, bad areas: 0

Current status
     ipos:    1000 GB, non-trimmed:    3145 kB,  current rate:  71761 kB/s
     opos:    1000 GB, non-scraped:        0 B,  average rate:  14452 kB/s
non-tried:  511377 kB,  bad-sector:        0 B,    error rate:       0 B/s
  rescued:  999690 MB,   bad areas:        0,        run time: 19h  7m 58s
pct rescued:   99.94%, read errors:       45,  remaining time:          8s
                              time since last successful read:          0s
Copying non-tried blocks... Pass 1 (forwards)
     ipos:    2293 kB, non-trimmed:    4849 kB,  current rate:   2490 kB/s
     opos:    2293 kB, non-scraped:        0 B,  average rate:  14405 kB/s
non-tried:  114491 kB,  bad-sector:        0 B,    error rate:   16384 B/s
  rescued:    1000 GB,   bad areas:        0,        run time: 19h 12m 16s
pct rescued:   99.98%, read errors:       71,  remaining time:         43s
                              time since last successful read:          0s
Copying non-tried blocks... Pass 2 (backwards)
     ipos:   60926 MB, non-trimmed:   17629 kB,  current rate:    305 kB/s
     opos:   60926 MB, non-scraped:        0 B,  average rate:  14243 kB/s
non-tried:        0 B,  bad-sector:        0 B,    error rate:   21845 B/s
  rescued:    1000 GB,   bad areas:        0,        run time: 19h 25m 27s
pct rescued:   99.99%, read errors:      266,  remaining time:         16m
                              time since last successful read:          0s
Copying non-tried blocks... Pass 5 (forwards)
     ipos:  753007 MB, non-trimmed:        0 B,  current rate:   49664 B/s
     opos:  753007 MB, non-scraped:    9629 kB,  average rate:  14113 kB/s
non-tried:        0 B,  bad-sector:    89600 B,    error rate:       0 B/s
  rescued:    1000 GB,   bad areas:      174,        run time: 19h 36m 10s
pct rescued:   99.99%, read errors:      441,  remaining time:          7m
                              time since last successful read:          0s
Trimming failed blocks... (forwards)
     ipos:   60926 MB, non-trimmed:        0 B,  current rate:       0 B/s
     opos:   60926 MB, non-scraped:        0 B,  average rate:  10985 kB/s
non-tried:        0 B,  bad-sector:    3078 kB,    error rate:     170 B/s
  rescued:    1000 GB,   bad areas:     2321,        run time:  1d  1h 11m
pct rescued:   99.99%, read errors:     6278,  remaining time:         36m
                              time since last successful read:         18s
Scraping failed blocks... (forwards)
     ipos:   60926 MB, non-trimmed:        0 B,  current rate:       0 B/s
     opos:   60926 MB, non-scraped:        0 B,  average rate:   9298 kB/s
non-tried:        0 B,  bad-sector:    2663 kB,    error rate:     170 B/s
  rescued:    1000 GB,   bad areas:     2036,        run time:  1d  5h 45m
pct rescued:   99.99%, read errors:    11481,  remaining time:     13h 12m
                              time since last successful read:          6s
Retrying bad sectors... Retry 1 (forwards)
     ipos:    2373 MB, non-trimmed:        0 B,  current rate:       0 B/s
     opos:    2373 MB, non-scraped:        0 B,  average rate:   8171 kB/s
non-tried:        0 B,  bad-sector:    2416 kB,    error rate:     170 B/s
  rescued:    1000 GB,   bad areas:     1861,        run time:  1d  9h 51m
pct rescued:   99.99%, read errors:    16200,  remaining time:         n/a
                              time since last successful read:     28m 39s
Retrying bad sectors... Retry 2 (backwards)
     ipos:   60926 MB, non-trimmed:        0 B,  current rate:       0 B/s
     opos:   60926 MB, non-scraped:        0 B,  average rate:   7337 kB/s
non-tried:        0 B,  bad-sector:    2291 kB,    error rate:       0 B/s
  rescued:    1000 GB,   bad areas:     1777,        run time:  1d 13h 42m
pct rescued:   99.99%, read errors:    20675,  remaining time:     16h 19m
                              time since last successful read:         31s
Retrying bad sectors... Retry 3 (forwards)
Finished
```

As you can see, `ddrescue` took a long time to run - about a day and a half.
However it recovered almost all of the files, minus a few megabytes of data.

I could have just stopped here, but I wanted to understand which files were actually corrupted/unrecoverable for posterity.
I don't use my desktop a lot, I really just use it for backups these days.
So the data on it is a) quite old, and I'm unlikely to need it but also b) could be sentimental and maybe I'll want it someday?

`ddrescue` writes a 'mapfile', which is how it is able to
a) resume execution if you hit ctrl-c and 
b) know where the bad sectors are

My mapfile is human readable and mine looked like this:

```
# Mapfile. Created by GNU ddrescue version 1.27
# Command line: ddrescue -d -r3 /dev/sda /mnt/new-storage/sda-backup.img /mnt/new-storage/sda-backup.logfile
# Start time:   2023-12-04 18:16:29
# Current time: 2023-12-06 07:58:46
# Finished
# current_pos  current_status  current_pass
0xE2F832C00     +               3
#      pos        size  status
0x00000000  0x8D71C000  +
0x8D71C000  0x00001000  -
0x8D71D000  0x00113000  +
0x8D830000  0x00000200  -
0x8D830200  0xBAEF4600  +
0x148724800  0x00000200  -
0x148724A00  0x00000200  +
0x148724C00  0x00000200  -
0x148724E00  0x3B1D31200  +
0x4FA456000  0x00001000  -
0x4FA457000  0xFF4E4200  +
...many more lines
```

You can see it's got alternating `+` and `-` symbols on the right-hand status column.
`+` indicates a good 'block' (contiguous space on the disk), and `-` indicates an unrecoverable block.
If we were to look at this mapfile during execution of dd rescue it would
have some other symbols which `ddrescue` uses to track what phase of the recovery it is in.

# Figuring out what data has been corrupted

The final piece of the puzzle is to figure out roughly where in the disk those bad sectors are.
Apparently since this is a disk image, `fdisk` is happy to treat it as if it is just a regular disk

```
$ fdisk -l /mnt/new-storage/sda-backup.img
Disk /mnt/new-storage/sda-backup.img: 931.51 GiB, 1000204886016 bytes, 1953525168 sectors
Units: sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
I/O size (minimum/optimal): 512 bytes / 512 bytes
Disklabel type: dos
Disk identifier: 0x00014884

Device                           Boot     Start        End    Sectors   Size Id Type
/mnt/new-storage/sda-backup.img1           2048  205611007  205608960    98G 83 Linux
/mnt/new-storage/sda-backup.img4      205613056 1953521663 1747908608 833.5G  5 Extended
/mnt/new-storage/sda-backup.img5      205615998  716804095  511188098 243.8G 83 Linux
/mnt/new-storage/sda-backup.img6      716806144 1953519615 1236713472 589.7G  7 HPFS/NTFS/exFAT
```

Things to know about this data:
* The mapfile records data as bytes in hex
* `fdisk` records data as _sectors_ in decimal

So to compare apples to apples, you need to convert the hex mapfile values to decimal bytes, and convert the sector
values to bytes by multiplying by the sector size, which is 512 bytes in this case.

Once I did that, I found something quite nice, which was that all of the bad sectors were located in that first 100GB Linux partition.
This partition was an old `/home` partition.
Not the ideal place to have corruption, but a lot of the stuff on this drive is just old junk and stuff I'm very unlikely to ever need again.

Mounting the disk image to poke around is relatively straightforward.
You don't want to mount the whole file, you want to mount from a particular offset in the file.
The following will do the job, where the `1048576` magic number is the start sector in the `fdisk` output above,
converted to bytes.

```
sudo mount -o loop,offset=1048576 /mnt/new-storage/sda-backup.img /mnt/bad-partition
```

I can now browse around the files and copy any off that I need, and I can do similar things for the other files
in the other uncorrupted partitions.

As a final exercise, I was keen to see if I could determine exactly which files corresponded to the corrupted blocks
that `ddrescue` was unable to restore.
[This stackoverflow answer](https://superuser.com/a/644744) was exactly what I was after.

As an example, the first bad block is at position `0x8D71C000`, which in decimal is `2373042176` bytes.
We need to subtract the offset from the start of the partition which is `1048576` from before.
Finally, we need to figure out which block it is in, giving us block `579100`.

```
$ sudo debugfs -R "icheck 579100" /dev/loop0
debugfs 1.47.0 (5-Feb-2023)
Block   Inode number
579100  190341

$ sudo debugfs -R 'ncheck 190341' /dev/loop0
debugfs 1.47.0 (5-Feb-2023)
Inode   Pathname
190341  /niksko/.config/google-chrome-beta.old/Default/Service Worker/CacheStorage/a16b7f81b709d2f9fb59c9edf2948180127a7ed2/3844f5fe-3191-483c-bc64-770bc09dece0/b838fa97da012c82_0
```

When `ddrescue` can't restore data, it just writes 0s instead.
Just to make sure that I had done all of the math and searching right, I opened up the file in question in Vim, and used
Vim's Hex mode using `:%!xxd`.
I then searched for `/0000 0000` and sure enough:

```
0003dfc0: 7428 6f2c 7b6b 6579 3a6e 2c6f 6e48 6964  t(o,{key:n,onHid
0003dfd0: 653a 6675 6e63 7469 6f6e 2065 2829 7b72  e:function e(){r
0003dfe0: 6574 7572 6e20 742e 6861 6e64 6c65 4869  eturn t.handleHi
0003dff0: 6465 2872 297d 7d29 7d29 2929 7d2c 747d  de(r)}})})))},t}
0003e000: 0000 0000 0000 0000 0000 0000 0000 0000  ................
0003e010: 0000 0000 0000 0000 0000 0000 0000 0000  ................
0003e020: 0000 0000 0000 0000 0000 0000 0000 0000  ................
...lots more zeros, then back to data
```

The exercise of writing a script that parses a `ddrescue` mapfile and looks up the filenames of all of the bad files
is left as an exercise to the reader :) (I don't care about the data enough at this stage to bother).
