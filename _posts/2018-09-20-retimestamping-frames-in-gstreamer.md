---
layout: post
title:  "Re-timestamping frames in Gstreamer"
author: "Kaustav"
comments: true
---

Once I had an issue with the wrong presentation timestamps of each frame buffers in Gstreamer. Because of this issue, vlc was unable to play an `UDP` stream coming from Gstreamer pipleine.

In my case, it's an Android app, which gets the frames from android `camera1 API` and then encodes them with `H.264` compression using Android `MediaCodec API`. After encoding, the encoded frame buffers along with their timestamps are directly given to the Gstreamer pipeline. But in our case there was no way to correct the timestamps on the Android side. So I came up with the below solution to correct the timestamps on the Gstreamer side.

As you might already know, there are two types of frame buffer timestamps. `DTS` or decoding timestamp refers to the timestamp when the buffer should be decoded and is usually monotonically increasing. `PTS` or presentation timestamp refers to the timestamp when the buffer content should be presented to the user and is not always monotonically increasing.

This is a simple Gstreamer pipeline example to get a stream of frames from Android side and send the video stream using `UDP`.

{% highlight markdown %}
appsrc stream-format=byte-stream alignment=au level=3.0 profile=baseline width=640 height=480
! h264parse ! rtph264pay pt=96 ! udpsink host=IP_ADDRESS port=PORT_NO sync=false
{% endhighlight %}

But in this case the frame timestamps are unchanged. Now, to change the timestamps of each buffer, we need to have access to each and every buffer. In this case, `identity` element comes into play. It's a dummy element that passes the incoming data through unmodified unless you explicitly tell it do something. In our solution, we will instruct it to modify the timestamps of each buffer. `identity` element emits `handoff` signal before passing the buffer downstream. `signal-handoffs`property needs to be set to TRUE, so that the `identity` will emit the `handoff` signal when handling a buffer. 

After adding the identity element to the pipeline, it looks like this.

{% highlight markdown %}
appsrc stream-format=byte-stream alignment=au level=3.0 profile=baseline width=640 height=480
! h264parse ! identity name="identity-elem" signal-handoffs=TRUE ! rtph264pay pt=96 ! udpsink host=IP_ADDRESS port=PORT_NO sync=false
{% endhighlight %}

A callback can be set on the `handoff` signal using the below code by accessing the element using it's name value.

{% highlight c linenos %}
GstElement *identity_elem = gst_bin_get_by_name(GST_BIN(pipeline_element), "identity-elem");
g_object_set(G_OBJECT(identity_elem), "signal-handoffs", TRUE, NULL);
g_signal_connect(data->identity, "handoff", cb_identity_handoff, data);
{% endhighlight %}

Atlast, each and every buffer needs to be re-timestamped with the correct values inside the callback function.

{% highlight c linenos %}
static GstClockTime ptimestamp = 0;

static void cb_identity_handoff (GstElement *identity, GstBuffer *buffer, CustomData *data) {
   int fps = 30; //In my case the FPS is 30

   buffer = gst_buffer_make_writable(buffer);

   ptimestamp += gst_util_uint64_scale_int (1, GST_SECOND, fps);
   GST_BUFFER_PTS (buffer) = ptimestamp;
   GST_BUFFER_DTS (buffer) = ptimestamp;

   GST_BUFFER_DURATION (buffer) = gst_util_uint64_scale_int (1, GST_SECOND, fps);
}
{% endhighlight %}

A simple formula is used in the above code. If the `FPS` is `30`, then in ideal scenario, each frame duration should be `1/30 sec`. Let's say that we set the `PTS` and `DTS` of the first frame to `0`. Then this frame should be displayed till it's duration i.e. `1/30sec`. Next comes the second frame. So, the `PTS` and `DTS` of the second frame should be `0 + (1/30)`. The duration of the second frame will also be `1/30sec`. And this same logic applies to the upcoming frames.

So, the formulas for the values of `PTS`, `DTS` and frame `duration` are

{% highlight c %}
PTS_of_current_frame = PTS_of_prev_frame + (1 / FPS)

DTS_of_current_frame = DTS_of_prev_frame + (1 / FPS)

frame_duration = 1 / FPS
{% endhighlight %}

`gst_util_uint64_scale_int(guint64 val, gint num, gint denom)` is an util function, which scales the `val` by the rational number `num / denom`, avoiding overflows and underflows and without loss of precision. `num` must be non-negative and `denom` must be positive. As the functions `GST_BUFFER_PTS()`, `GST_BUFFER_DTS()` and `GST_BUFFER_DURATION()` take input in nanoseconds, the values assigned to them must also be in nanoseconds. Because of this reason, I multiplied the output of `1 / FPS` with the [GST_SECOND](https://gstreamer.freedesktop.org/data/doc/gstreamer/head/gstreamer/html/GstClock.html#GST-SECOND:CAPS).







