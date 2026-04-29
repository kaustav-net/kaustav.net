---
title: "Hello World"
date: 2026-04-29
draft: false
tags: ["general"]
description: "First post on the new blog."
---

Welcome to my blog! I write about real-time communication, WebRTC, Chromium internals, bandwidth estimation, and related topics.

## What to Expect

This blog will cover:

- **WebRTC** — deep dives into the protocol stack, media pipeline, and browser implementation
- **Chromium** — internals, debugging tips, and contribution notes
- **Bandwidth Estimation (BWE)** — algorithms like GCC, BBR, and their behavior in real networks
- **GStreamer** — pipelines, plugins, and integration with RTC systems
- **General systems programming** — C++, networking, and performance

## Code Example

Here's a simple example of creating a PeerConnection:

```javascript
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

pc.onicecandidate = (event) => {
  if (event.candidate) {
    console.log('New ICE candidate:', event.candidate);
  }
};
```

Stay tuned for more posts!
