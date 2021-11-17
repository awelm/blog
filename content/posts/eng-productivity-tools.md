---
title: "Tools That Improved My Engineering Productivity"
date: 2021-11-17T18:01:35-05:00
draft: true
---

My friends and coworkers often ask me what tools I use because they know I am a productivity enthusiast. I have always enjoyed improving my productivity because the feeling of efficiency makes working more enjoyable for me. And when working is fun, I work longer and happily get more things done. This post shares my favorite productivity tools and tips I've amassed over the last 5 years.

I'm deliberately not including common productivity tips like what task management tool to use or productivity philosophies (GTD, Pomodoro, etc). Although my tips are meant for programmers, most of them are actually beneficial to any computer user. Even though I'm assuming you have MacOS, many tips provided here are OS agnostic. In each section below, the bullet points are listed in order of importance.

### Apps

1. [Paste](https://pasteapp.io/): Using Paste is the one thing that has improved my productivity the most. Paste lets you view or search your clipboard history and then paste your selected result. The way I describe it to programmers is "Paste is like Control-R for your clipboard history". Let's imagine that you want to send your friend a Ticketmaster link you copied to your clipboard last week. Instead of digging through your browser history and then copy-pasting the link, with Paste all you need to do is press `Command-Shift-V` and type in `ticket` to find and paste the link. Paste is a paid app (with free trial) and is only available for Mac.
2. [Fork](https://git-fork.com/): I find Git GUI clients to be extremely helpful once a codebase reaches a certain level of complexity. I've tried popular offerings like SourceTree and Github Desktop, but Fork is by far the best client I've seen. My favorite Fork feature is being able to view the diff between any 2 commits, which was surprisingly missing from the other clients I tried. Fork also lets you stash or discard code changes at the chunk-level, which is extremely useful when addressing comments during code reviews. Fork is a free app (with an encouraged donation) and is available for Mac and Windows.
3. [Contexts](https://contexts.co/): If you love full-screen windows, you might be painfully aware that there's no keyboard shortcut to switch between full-screen windows of the same application. This bugged me for many years until I found Contexts. Now I can switch between full-screen windows of the same app using `` Command-` ``. Contexts is a paid app (with free trial) and is available on all platforms.
4. [Alfred](https://www.alfredapp.com/): You might have noticed MacOS Spotlight often shows irrelevant files and other unhelpful search results. Alfred is a Spotlight replacement that is faster and only shows apps by default when you search. If you want to search for files only, just add a `'` to the start of your query. It also provides keyboard shortcuts to jump to each displayed search result, which is pretty cool. Alfred is a free app and is only available for Mac.

### MacOS Setting Changes

1. [Max out Tracking Speed](https://support.apple.com/guide/mac-help/change-your-mouses-response-speed-mchlp1138/mac): The default trackpad sensitivity is quite low, which means you often have to swipe across the trackpad multiple times to navigate to your desired location. This repeated swiping is very slow and also not ergonomically friendly. After maxing out my trackpad sensitivity, I can navigate anywhere without even traversing half the trackpad. It takes a while to get used to, but I promise its worth it.
2. [Max out Key Repeat:](https://support.apple.com/guide/mac-help/change-keyboard-preferences-on-mac-kbdm162/12.0/mac/12.0) The default key repeat frequency is frustratingly slow. This becomes apparent when holding down backspace to delete things or when using an arrow key to navigate somewhere. You can fix this by maximizing *Key Repeat* and minimizing *Delay Until Repeat* in your Keyboard preferences.

### Browser Extensions

We spend a huge amount of time in our browsers, so making our web browsing experience more efficient can be very impactful.

1. [Quick Tabs](https://chrome.google.com/webstore/detail/quick-tabs/jnjfeinjfmenlddahdjdmgpbokiacbbb?hl=en): Lets you swiftly navigate between tabs in an MRU fashion (similar to how `Command-Tab` works). You can also navigate to any open tab via fuzzy search. Quick Tabs is free and available on Chrome and Firefox.
2. [News Feed Eradicator](https://chrome.google.com/webstore/detail/news-feed-eradicator/fjcldmjmjhkklehbacihaiopjklihlgg?hl=en): Blocks all feeds from sites like Facebook or Youtube and shows you a motivational quote instead. Don't worry you can still search and interact with content, friends, etc. It's also easy to temporarily disable the feed block. This extension encourages you to use these sites in an intentional manner without getting distracted by the feeds designed to keep you scrolling. News Feed Eradicator is free and available on Chrome and Firefox.
3. [Trotto](https://www.trot.to/getting-started): Lets you create Go Links very quickly. The other Go Link extensions I've seen are built for enterprises and usually require company-level licensing. It's much easier to get started with Trotto because it's built for the individual first. Trotto is free and available on Chrome and Firefox.
4. [Flow](https://enterflow.app/): Lets you open and close a set of related tabs with one click. This reduces your tab clutter, which tends to translate into mental clutter. Flow is free and only available on Chrome.

### Terminal and IDE Extensions

I'm assuming that you are using iTerm2 with a ZSH shell.

1. [vscodevim](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim) (or Emacs equivalent): As programmers we spend so much time editing text, so it makes a lot of sense to use a tool like Vim that was specifically designed for text editing. However, I've found it impractical to use CLI Vim at work because it lacks the internal tooling that companies typically build around their preferred IDE. By using a Vim IDE extension instead, you retain your Vim superpowers and your access to internal tooling. Most IDEs will have extensions that provide Vim or Emacs emulation, so you don't necessarily need to use VS Code.
2.  [zsh-vi-mode](https://github.com/jeffreytse/zsh-vi-mode) (or Emacs equivalent): This ZSH plugin lets you compose your shell command in a Vim fashion.
3. [fzf](https://github.com/junegunn/fzf): `Control-R` is great, but its way better when it uses fuzzy search. fzf lets you add fuzzy search to multiple aspects of your command line but I only use it modify my `Control-R`.
4. [iTerm2 tmux Integration](https://iterm2.com/documentation-tmux-integration.html): If you frequently connect to a remote server to do non-trivial things, tmux is an indispensable tool. tmux lets you create new tabs, split windows, and restore state once you re-login. tmux is unwieldy to use though, and this integration lets you perform tmux actions using the iTerm2 native shortcuts that you're probably already familiar with. For example, you can use the trackpad to scroll through past outputs instead of pressing `Control-B` and then `[`.


