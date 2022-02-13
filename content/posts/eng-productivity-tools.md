---
title: "Tools That Improved My Engineering Productivity"
date: 2021-11-17T18:01:35-05:00
draft: false
---

My friends and coworkers often ask me what tools I use because they view me as a productivity enthusiast. I have always enjoyed improving my productivity because the feeling of efficiency makes working more enjoyable. This post shares my favorite productivity tools and tips I’ve amassed over the last 5 years.

I’m deliberately not including common tips like which task management tool or IDE to use. Instead I hope to introduce you to useful tools you've never seen before. I’m assuming you're running MacOS, but many tips provided below are OS agnostic.
### Apps

1. [Paste](https://pasteapp.io/)\
This app that has undoubtedly improved my productivity the most. Paste lets you view or search your clipboard history and then paste your selected result. Let's imagine that you want to send your friend a Ticketmaster link you copied to your clipboard last week. Instead of digging through your browser history and then copy-pasting the link, with Paste all you need to do is press `Command-Shift-V` and type in `ticket` to find and paste the link. Paste is a paid app (with free trial) and is only available for Mac.
![Paste Image](/paste.gif)
> Paste is like Control-R for your clipboard history

2. [Fork](https://git-fork.com/)\
It took me a long time to find a Git client I was satisfied with. I tried popular offerings like SourceTree and Github Desktop, but Fork is by far the best client I’ve seen. Fork is very fast, beautifully designed, and has powerful features. My favorite feature is being able to view the diff between any 2 commits, which was surprisingly missing from the other clients I tried. Fork also lets you stash or discard code changes at the chunk-level. This is extremely useful when addressing comments during code reviews. Fork is a free app and is available for Mac and Windows.
![Fork Image](/fork.jpeg)

3. [Contexts](https://contexts.co/)\
If you love full-screen windows, you might be painfully aware that there's no keyboard shortcut to switch between full-screen windows of the same application. This bothered me for many years until I found Contexts. Now I can switch between full-screen windows of the same app using `` Command-` ``. Contexts is a paid app (with free trial) and is available on all platforms.
4. [Alfred](https://www.alfredapp.com/)\
You might have noticed MacOS Spotlight often shows irrelevant files and other unhelpful search results. Alfred is a Spotlight replacement that is faster and only shows apps by default when you search. If you want to search for files only, just add a `'` to the start of your query. It also provides keyboard shortcuts to jump to each displayed search result, which is pretty cool. Alfred is a free app and is only available for Mac.
![Alfred Image](/alfred.jpeg)

### MacOS Setting Changes

1. [Max out Tracking Speed](https://support.apple.com/guide/mac-help/change-your-mouses-response-speed-mchlp1138/mac)\
The default trackpad sensitivity is quite low, which means you often have to swipe multiple times to navigate anywhere. This excessive swiping is very slow and also not ergonomically friendly. After maxing out my trackpad sensitivity, I can navigate anywhere without even using half the trackpad. It takes a while to get used to, but I promise its worth it.
2. [Max out Key Repeat](https://support.apple.com/guide/mac-help/change-keyboard-preferences-on-mac-kbdm162/12.0/mac/12.0)\
The default key repeat frequency is frustratingly slow. This becomes apparent when holding down backspace to delete things or when using an arrow key to navigate somewhere. You can fix this by maximizing *Key Repeat* and minimizing *Delay Until Repeat* in your Keyboard preferences.

### Browser Extensions

We spend a huge amount of time in our browsers, so making our web browsing experience more efficient can be very impactful.

1. [Quick Tabs](https://chrome.google.com/webstore/detail/quick-tabs/jnjfeinjfmenlddahdjdmgpbokiacbbb?hl=en)\
Provides hotkeys to swiftly navigate between tabs in an MRU fashion (similar to how `Command-Tab` works). You can also navigate to any open tab via fuzzy search. Quick Tabs is free and available on Chrome and Firefox.
![QuickTabs Image](/quicktabs.jpeg)

2. [News Feed Eradicator](https://chrome.google.com/webstore/detail/news-feed-eradicator/fjcldmjmjhkklehbacihaiopjklihlgg?hl=en)\
Blocks all feeds from sites like Facebook or Youtube and shows you a motivational quote instead. However you can still search and interact with content, friends, etc. It's also easy to temporarily disable the feed block. This extension encourages you to use these sites in an intentional manner without getting distracted by the feeds designed to keep you scrolling. News Feed Eradicator is free and available on Chrome and Firefox.
![News Feed Eradicator Image](/newsFeedEradicator.jpeg)

3. [Trotto](https://www.trot.to/getting-started)\
Lets you quickly create Go Links. The other Go Link extensions I’ve seen are built for enterprises and usually require company licenses. It’s much easier to get started with Trotto because it’s built for the individual first. Trotto is free and available on Chrome and Firefox.
4. [Flow](https://enterflow.app/)\
Lets you open and close a set of related tabs with one click. This reduces your tab clutter, which tends to cause mental clutter. Flow is free and only available on Chrome.
![Flow Image](/flow.png)
> Flow is like Git branches for your browser
### Terminal and IDE Extensions
If you aren't already using [iTerm2](https://iterm2.com/), [VS Code](https://code.visualstudio.com/), and [ZSH](https://opensource.com/article/19/9/getting-started-zsh), I'd highly recommend trying them out. Because these 3 tools are effectively the industry standard today, the recommendations below assume you use them.

1. [vscodevim](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim)\
A VS Code extension that provides Vim functionality inside your IDE. Using CLI Vim on the job is often impractical because it lacks the internal tooling that companies typically build around their preferred IDE. Most IDEs will have extensions that provide Vim or Emacs emulation, so you don't necessarily need to use VS Code to benefit from these extensions.
2.  [zsh-vi-mode](https://github.com/jeffreytse/zsh-vi-mode)\
This ZSH plugin lets you compose shell commands and navigate your terminal using Vim key bindings. This can be super helpful when crafting and editing long commands.
![ZSH Vi Mode](/zsh-vi-mode.gif)
3. [fzf](https://github.com/junegunn/fzf)\
`Control-R` is great, but its **way** better when it uses fuzzy search instead of substring matching. fzf lets you add fuzzy search to multiple aspects of your command line but I only use it modify my `Control-R`.
![fzf image](/fzf.gif)
4. [iTerm2 tmux Integration](https://iterm2.com/documentation-tmux-integration.html)\
If you frequently connect to a remote server to do non-trivial things, tmux is an indispensable tool. For those who are unfamiliar, tmux enhances your SSH experience by letting you create new tabs/windows and restore your previous session state. tmux is unwieldy to use though, and this integration improves things by letting you perform tmux actions using the iTerm2 native shortcuts that you're probably already familiar with. For example, you can use the trackpad to scroll through past outputs instead of pressing `Control-B` and then `[`.
![iterm tmux integration image](/tmux.png)


\
Hopefully some of these recommendations were helpful and improve your dev velocity. If you enjoyed this post, consider subscribing to receive email updates when I release new content.
