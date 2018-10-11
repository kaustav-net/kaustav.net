---
layout: post
title:  "Introduction to the Android framebuffer"
author: "Kaustav"
comments: true
---

**Framebuffer** is usually used as the driver of display devices. framebuffer driver is a character device, device node is `/dev/fbX` (in Android it's `/dev/graphics/fbX`, usually `/dev/graphics/fb0`). User can regard framebuffer as one of display memory. Once the image is mapped to the process address space, it can be read and written directly, and the write operation can be immediately reflected on the screen. This kind of operation is abstract and unified. The user does not have to care about the location of the physical memory, the page-changing mechanism, and so on. These are all done by the framebuffer device driver. The framebuffer device provides system calls for upper-level applications and interfaces to specific hardware drivers for the next layer; those underlying hardware drivers need to use the interfaces here to register themselves with the linux kernel.

The framebuffer device belongs to the character device and adopts the `file layer-driver layer` interface mode. Linux defines the interface `fb_info` structure of the `driver layer` for the frame buffer device. On the `file layer`, the user calls the function operation of `file_operations` to indirectly call the `fb_ops` function in `fb_info`. Set to operate the hardware.

## Framebuffer data structures

`fb_info` defined in `kernel\include\linux\fb.h` is the `driver layer` interface defined by Linux for framebuffer devices. It not only contains the underlying functions, but also the data that records the state of the device. Each frame buffer device corresponds to an `fb_info` structure.

{% highlight c linenos %}
struct fb_info {
	atomic_t count;
	int node;
	int flags;
	struct mutex lock;		/* Lock for open/release/ioctl funcs */
	struct mutex mm_lock;		/* Lock for fb_mmap and smem_* fields */
	struct fb_var_screeninfo var;	/* Current var */
	struct fb_fix_screeninfo fix;	/* Current fix */
	struct fb_monspecs monspecs;	/* Current Monitor specs */
	struct work_struct queue;	/* Framebuffer event queue */
	struct fb_pixmap pixmap;	/* Image hardware mapper */
	struct fb_pixmap sprite;	/* Cursor hardware mapper */
	struct fb_cmap cmap;		/* Current cmap */
	struct list_head modelist;      /* mode list */
	struct fb_videomode *mode;	/* current mode */
	struct file *file;		/* current file node */

#ifdef CONFIG_FB_DEFERRED_IO
	struct delayed_work deferred_work;
	struct fb_deferred_io *fbdefio;
#endif

	struct fb_ops *fbops;
	struct device *device;		/* This is the parent */
	struct device *dev;		/* This is this fb device */
	int class_flag;                    /* private sysfs flags */
#ifdef CONFIG_FB_TILEBLITTING
	struct fb_tile_ops *tileops;    /* Tile Blitting */
#endif
	char __iomem *screen_base;	/* Virtual address */
	unsigned long screen_size;	/* Amount of ioremapped VRAM or 0 */ 
	void *pseudo_palette;		/* Fake palette of 16 colors */ 
#define FBINFO_STATE_RUNNING	0
#define FBINFO_STATE_SUSPENDED	1
	u32 state;			/* Hardware state i.e suspend */
	void *fbcon_par;                /* fbcon use-only private area */
	/* From here on everything is device dependent */
	void *par;
	/* we need the PCI or similar aperture base/size not
	   smem_start/size as smem_start may just be an object
	   allocated inside the aperture so may not actually overlap */
	struct apertures_struct {
		unsigned int count;
		struct aperture {
			resource_size_t base;
			resource_size_t size;
		} ranges[0];
	} *apertures;

	bool skip_vt_switch; /* no VT switch on suspend/resume required */
};
{% endhighlight %}


`fb_var_screeninfo` is used to record user-modifiable display controller parameters, including screen resolution, number of bits per pixel, etc.

{% highlight c linenos %}
struct fb_var_screeninfo {
   __u32 xres;
   __u32 yres;
   __u32 xres_virtual;
   __u32 yres_virtual;
   __u32 xoffset;
   __u32 yoffset;

   __u32 bits_per_pixel;
   __u32 grayscale;

 	struct fb_bitfield red;
 	struct fb_bitfield green;
 	struct fb_bitfield blue;
 	struct fb_bitfield transp;			/* transparency			*/

    __u32 nonstd;						/* != 0 Non standard pixel format */

    __u32 activate;					/* see FB_ACTIVATE_*		*/

    __u32 height;
    __u32 width;

    __u32 accel_flags;					/* (OBSOLETE) see fb_info.flags */

    __u32 pixclock;					/* pixel clock in ps (pico seconds) */
    __u32 left_margin;
    __u32 right_margin;				
    __u32 upper_margin;				
    __u32 lower_margin;
    __u32 hsync_len;					/* length of horizontal sync	*/
    __u32 vsync_len;					/* length of vertical sync	*/
	__u32 sync;						/* see FB_SYNC_*		*/
	__u32 vmode;						/* see FB_VMODE_*		*/						
	__u32 rotate;						/* angle we rotate counter clockwise */
	__u32 reserved[5];                 /* Reserved for future compatibility */
};
{% endhighlight %}

`fb_fix_screeninfo` records the parameters of the display controller that the user cannot modify. These parameters are set when the driver is initialized.

{% highlight c linenos %}
struct fb_fix_screeninfo {
	char id[16];			/* identification string eg "TT Builtin" */
	unsigned long smem_start;/* Start of frame buffer mem */
	__u32 smem_len;			/* Length of frame buffer mem */
	__u32 type;			    /* see FB_TYPE_*		*/
	__u32 type_aux;			/* Interleave for interleaved Planes */
	__u32 visual;			/* see FB_VISUAL_*		*/ 
	__u16 xpanstep;			/* zero if no hardware panning  */
	__u16 ypanstep;			/* zero if no hardware panning  */
	__u16 ywrapstep;		/* zero if no hardware ywrap    */
	__u32 line_length;		/* length of a line in bytes    */
	unsigned long mmio_start;/* Start of Memory Mapped I/O   */
	__u32 mmio_len;			/* Length of Memory Mapped I/O  */
	__u32 accel;			/* Indicate to driver which	*/
	__u16 reserved[3];		/* Reserved for future compatibility */
};
{% endhighlight %}


`fb_ops` is an interface provided to the underlying device driver. When we write to a framebuffer, we must fill in the `fb_ops` structure according to the Linux framebuffer programming routine.

{% highlight c linenos %}
struct fb_ops {
	/* open/release and usage marking */
	struct module *owner;
	int (*fb_open)(struct fb_info *info, int user);
	int (*fb_release)(struct fb_info *info, int user);

	/* For framebuffers with strange non linear layouts or that do not
	 * work with normal memory mapped access
	 */
	ssize_t (*fb_read)(struct fb_info *info, char __user *buf,
			   size_t count, loff_t *ppos);
	ssize_t (*fb_write)(struct fb_info *info, const char __user *buf,
			    size_t count, loff_t *ppos);

	/* checks var and eventually tweaks it to something supported,
	 * DO NOT MODIFY PAR */
	int (*fb_check_var)(struct fb_var_screeninfo *var, struct fb_info *info);

	/* set the video mode according to info->var */
	int (*fb_set_par)(struct fb_info *info);

	/* set color register */
	int (*fb_setcolreg)(unsigned regno, unsigned red, unsigned green,
			    unsigned blue, unsigned transp, struct fb_info *info);

	/* set color registers in batch */
	int (*fb_setcmap)(struct fb_cmap *cmap, struct fb_info *info);

	/* blank display */
	int (*fb_blank)(int blank, struct fb_info *info);

	/* pan display */
	int (*fb_pan_display)(struct fb_var_screeninfo *var, struct fb_info *info);

	/* Draws a rectangle */
	void (*fb_fillrect) (struct fb_info *info, const struct fb_fillrect *rect);
	/* Copy data from area to another */
	void (*fb_copyarea) (struct fb_info *info, const struct fb_copyarea *region);
	/* Draws a image to the display */
	void (*fb_imageblit) (struct fb_info *info, const struct fb_image *image);

	/* Draws cursor */
	int (*fb_cursor) (struct fb_info *info, struct fb_cursor *cursor);

	/* Rotates the display */
	void (*fb_rotate)(struct fb_info *info, int angle);

	/* wait for blit idle, optional */
	int (*fb_sync)(struct fb_info *info);

	/* perform fb specific ioctl (optional) */
	int (*fb_ioctl)(struct fb_info *info, unsigned int cmd,
			unsigned long arg);

	/* Handle 32bit compat ioctl (optional) */
	int (*fb_compat_ioctl)(struct fb_info *info, unsigned cmd,
			unsigned long arg);

	/* perform fb specific mmap */
	int (*fb_mmap)(struct fb_info *info, struct vm_area_struct *vma);

	/* get capability given var */
	void (*fb_get_caps)(struct fb_info *info, struct fb_blit_caps *caps,
			    struct fb_var_screeninfo *var);

	/* teardown any resources to do with this framebuffer */
	void (*fb_destroy)(struct fb_info *info);

	/* called at KDB enter and leave time to prepare the console */
	int (*fb_debug_enter)(struct fb_info *info);
	int (*fb_debug_leave)(struct fb_info *info);
};
{% endhighlight %}
 

## Framebuffer module initialization process
The framebuffer driver is registered in the system as a module. When the module is initialized, the device file and proc file corresponding to the framebuffer are created, and the framebuffer device operation interface function is registered. 

`fbmem_init()` defined in `kernel\drivers\video\fbmem.c`, initializes frame buffer subsystem, which is initialized from the below code,

{% highlight c linenos %}
module_init(fbmem_init);
{% endhighlight %}

{% highlight c linenos %}
static int __init
fbmem_init(void)
{
	proc_create("fb", 0, NULL, &fb_proc_fops);

	//#define FB_MAJOR		29 	
	if (register_chrdev(FB_MAJOR,"fb",&fb_fops))
		printk("unable to get major %d for fb devs\n", FB_MAJOR);

	// create a sys/class/graphics directory
	fb_class = class_create(THIS_MODULE, "graphics");
	if (IS_ERR(fb_class)) {
		printk(KERN_WARNING "Unable to create fb class; errno = %ld\n", PTR_ERR(fb_class));
		fb_class = NULL;
	}
	return 0;
}
{% endhighlight %}

First create an `fb` file in the proc file system, and register the interface function that operates the file:

{% highlight c linenos %}
static const struct file_operations fb_proc_fops = {
	.owner		= THIS_MODULE,
	.open		= proc_fb_open,
	.read		= seq_read,
	.llseek		= seq_lseek,
	.release	= seq_release,
};
{% endhighlight %}

Therefore, the `/proc/fb` file can be opened, read and written. Then register a character device with the major device number `29`, and the file operation interface function `fb_fops` of the character device is registered in the `fbmem_init` function, which is defined as follows:

{% highlight c linenos %}
static const struct file_operations fb_fops = {
	.owner =	THIS_MODULE,
	.read =		fb_read,
	.write =	fb_write,
	.unlocked_ioctl = fb_ioctl,
#ifdef CONFIG_COMPAT
	.compat_ioctl = fb_compat_ioctl,
#endif
	.mmap =		fb_mmap,
	.open =		fb_open,
	.release =	fb_release,
#ifdef HAVE_ARCH_FB_UNMAPPED_AREA
	.get_unmapped_area = get_fb_unmapped_area,
#endif
#ifdef CONFIG_FB_DEFERRED_IO
	.fsync =	fb_deferred_io_fsync,
#endif
	.llseek =	default_llseek,
};
{% endhighlight %}

## Framebuffer driver registration process
Important variable definitions in the registration process:

{% highlight c linenos %}
// registered framebuffer drivers
extern struct fb_info *registered_fb[FB_MAX];
// number of registered framebuffer drivers
extern int num_registered_fb;
{% endhighlight %}

Any particular hardware framebuffer driver must be registered with fbmem.c during initialization. The framebuffer module provides the driver registration interface function `register_framebuffer`:

{% highlight c linenos %}
/**
 *	register_framebuffer - registers a frame buffer device
 *	@fb_info: frame buffer info structure
 *
 *	Registers a frame buffer device @fb_info.
 *
 *	Returns negative errno on error, or zero for success.
 *
 */
int register_framebuffer(struct fb_info *fb_info)
{
	int ret;

	mutex_lock(&registration_lock);
	ret = do_register_framebuffer(fb_info);
	mutex_unlock(&registration_lock);

	return ret;
}
{% endhighlight %}


{% highlight c linenos %}
static int do_register_framebuffer(struct fb_info *fb_info)
{
	int i;
	struct fb_event event;
	struct fb_videomode mode;

	if (fb_check_foreignness(fb_info))
		return -ENOSYS;

	do_remove_conflicting_framebuffers(fb_info->apertures, fb_info->fix.id,
					 fb_is_primary_device(fb_info));

	if (num_registered_fb == FB_MAX)
		return -ENXIO;

	num_registered_fb++;
	for (i = 0 ; i < FB_MAX; i++)
		if (!registered_fb[i])
			break;
	fb_info->node = i;
	atomic_set(&fb_info->count, 1);
	mutex_init(&fb_info->lock);
	mutex_init(&fb_info->mm_lock);

	fb_info->dev = device_create(fb_class, fb_info->device,
				     MKDEV(FB_MAJOR, i), NULL, "fb%d", i);
	if (IS_ERR(fb_info->dev)) {
		/* Not fatal */
		printk(KERN_WARNING "Unable to create device for framebuffer %d; errno = %ld\n", i, PTR_ERR(fb_info->dev));
		fb_info->dev = NULL;
	} else
		fb_init_device(fb_info);

	if (fb_info->pixmap.addr == NULL) {
		fb_info->pixmap.addr = kmalloc(FBPIXMAPSIZE, GFP_KERNEL);
		if (fb_info->pixmap.addr) {
			fb_info->pixmap.size = FBPIXMAPSIZE;
			fb_info->pixmap.buf_align = 1;
			fb_info->pixmap.scan_align = 1;
			fb_info->pixmap.access_align = 32;
			fb_info->pixmap.flags = FB_PIXMAP_DEFAULT;
		}
	}	
	fb_info->pixmap.offset = 0;

	if (!fb_info->pixmap.blit_x)
		fb_info->pixmap.blit_x = ~(u32)0;

	if (!fb_info->pixmap.blit_y)
		fb_info->pixmap.blit_y = ~(u32)0;

	if (!fb_info->modelist.prev || !fb_info->modelist.next)
		INIT_LIST_HEAD(&fb_info->modelist);

	if (fb_info->skip_vt_switch)
		pm_vt_switch_required(fb_info->dev, false);
	else
		pm_vt_switch_required(fb_info->dev, true);

	fb_var_to_videomode(&mode, &fb_info->var);
	fb_add_videomode(&mode, &fb_info->modelist);
	registered_fb[i] = fb_info;

	event.info = fb_info;
	if (!lock_fb_info(fb_info))
		return -ENODEV;
	console_lock();
	fb_notifier_call_chain(FB_EVENT_FB_REGISTERED, &event);
	console_unlock();
	unlock_fb_info(fb_info);
	return 0;
}
{% endhighlight %}

The parameter `fb_info` describes the framebuffer driver information of a specific hardware.

The registration process is to store the specified device driver information `fb_info` in the `registered_fb` array. Therefore, when registering a specific `fb_info`, first construct an `fb_info` data structure and initialize the data structure, which is used to describe a specific framebuffer driver.

## fbX device file opening process
`fb_open` opens the device file `fb0` corresponding to the following operation:

{% highlight c linenos %}
static int fb_open(struct inode *inode, struct file *file)
__acquires(&info->lock)
__releases(&info->lock)
{
	// get the minor device number from the file node
	int fbidx = iminor(inode);
	struct fb_info *info;
	int res = 0;
	// extract the corresponding fb_info from the registered_fb array according to the minor device number
	info = get_fb_info(fbidx);
	if (!info) {
		request_module("fb%d", fbidx);
		info = get_fb_info(fbidx);
		if (!info)
			return -ENODEV;
	}
	if (IS_ERR(info))
		return PTR_ERR(info);
	mutex_lock(&info->lock);
	if (!try_module_get(info->fbops->owner)) {
		res = -ENODEV;
		goto out;
	}
	//Save the current fb_info to the private_data member of the /dev/fbx device file
	file->private_data = info;
	if (info->fbops->fb_open) {
		// call the current fb_open function of fb_info to open the current framebuffer device
		res = info->fbops->fb_open(info,1);
		if (res)
			module_put(info->fbops->owner);
	}
#ifdef CONFIG_FB_DEFERRED_IO
	if (info->fbdefio)
		fb_deferred_io_open(info, inode, file);
#endif
out:
	mutex_unlock(&info->lock);
	if (res)
		put_fb_info(info);
	return res;
}
{% endhighlight %}


The opening process is very simple. First, remove the `fb_info` data information of the framebuffer from the file node, and save it to the `private_data` variable of the device file, and then call the `fb_open` function in the current `fb_info` to complete the device opening process. This function registers the corresponding `open` function pointer when constructing the concrete `fb_info` and registering the framebuffer.


## fbX device file mapping process

{% highlight c linenos %}
static int fb_mmap(struct file *file, struct vm_area_struct * vma)
{
	// take fb_info from the file node and determine if it is the same as fb_info in the private_data variable
	struct fb_info *info = file_fb_info(file);
	struct fb_ops *fb;
	unsigned long off;
	unsigned long start;
	u32 len;
	if (!info)
		return -ENODEV;
	if (vma->vm_pgoff > (~0UL >> PAGE_SHIFT))
		return -EINVAL;
	off = vma->vm_pgoff << PAGE_SHIFT;
	fb = info->fbops;
	if (!fb)
		return -ENODEV;
	mutex_lock(&info->mm_lock);
	// if fb_mmap is registered in fb_info, fb_mmap in fb_info is called to complete address space mapping.
	if (fb->fb_mmap) {
		int res;
		res = fb->fb_mmap(info, vma);
		mutex_unlock(&info->mm_lock);
		return res;
	}
	
	start = info->fix.smem_start;
	len = PAGE_ALIGN((start & ~PAGE_MASK) + info->fix.smem_len);
	if (off >= len) {
		/* memory mapped io */
		off -= len;
		if (info->var.accel_flags) {
			mutex_unlock(&info->mm_lock);
			return -EINVAL;
		}
		start = info->fix.mmio_start;
		len = PAGE_ALIGN((start & ~PAGE_MASK) + info->fix.mmio_len);
	}
	mutex_unlock(&info->mm_lock);
	start &= PAGE_MASK;
	if ((vma->vm_end - vma->vm_start + off) > len)
		return -EINVAL;
	off += start;
	vma->vm_pgoff = off >> PAGE_SHIFT;
	/* This is an IO map - tell maydump to skip this VMA */
	vma->vm_flags |= VM_IO | VM_RESERVED;
	vma->vm_page_prot = vm_get_page_prot(vma->vm_flags);
	fb_pgprotect(file, vma, off);
	if (io_remap_pfn_range(vma, vma->vm_start, off >> PAGE_SHIFT,
			     vma->vm_end - vma->vm_start, vma->vm_page_prot))
		return -EAGAIN;
	return 0;
}
{% endhighlight %}

Here, similar to the fb open process, the mapping function of the specific `fb_info` is still used to complete the address space mapping process. But there is also a difference, that is, when the specific `fb_info` does not implement the address space mapping, the mapping process is completed at the framebuffer layer.

`do_fb_ioctl()` is the `ioctl handler` for `fbX` device files to handle the `ioctl` calls from the upper layer.

{% highlight c linenos %}
static long do_fb_ioctl(struct fb_info *info, unsigned int cmd,unsigned long arg)
{
	struct fb_ops *fb;
	struct fb_var_screeninfo var;
	struct fb_fix_screeninfo fix;
	struct fb_con2fbmap con2fb;
	struct fb_cmap cmap_from;
	struct fb_cmap_user cmap;
	struct fb_event event;
	void __user *argp = (void __user *)arg;
	long ret = 0;
	switch (cmd) {
	case FBIOGET_VSCREENINFO:
		if (!lock_fb_info(info))
			return -ENODEV;
		var = info->var;
		unlock_fb_info(info);

		ret = copy_to_user(argp, &var, sizeof(var)) ? -EFAULT : 0;
		break;
	case FBIOPUT_VSCREENINFO:
		if (copy_from_user(&var, argp, sizeof(var)))
			return -EFAULT;
		if (!lock_fb_info(info))
			return -ENODEV;
		console_lock();
		info->flags |= FBINFO_MISC_USEREVENT;
		ret = fb_set_var(info, &var);
		info->flags &= ~FBINFO_MISC_USEREVENT;
		console_unlock();
		unlock_fb_info(info);
		if (!ret && copy_to_user(argp, &var, sizeof(var)))
			ret = -EFAULT;
		break;
	case FBIOGET_FSCREENINFO:
		if (!lock_fb_info(info))
			return -ENODEV;
		fix = info->fix;
		unlock_fb_info(info);

		ret = copy_to_user(argp, &fix, sizeof(fix)) ? -EFAULT : 0;
		break;
	case FBIOPUTCMAP:
		if (copy_from_user(&cmap, argp, sizeof(cmap)))
			return -EFAULT;
		ret = fb_set_user_cmap(&cmap, info);
		break;
	case FBIOGETCMAP:
		if (copy_from_user(&cmap, argp, sizeof(cmap)))
			return -EFAULT;
		if (!lock_fb_info(info))
			return -ENODEV;
		cmap_from = info->cmap;
		unlock_fb_info(info);
		ret = fb_cmap_to_user(&cmap_from, &cmap);
		break;
	case FBIOPAN_DISPLAY:
		if (copy_from_user(&var, argp, sizeof(var)))
			return -EFAULT;
		if (!lock_fb_info(info))
			return -ENODEV;
		console_lock();
		ret = fb_pan_display(info, &var);
		console_unlock();
		unlock_fb_info(info);
		if (ret == 0 && copy_to_user(argp, &var, sizeof(var)))
			return -EFAULT;
		break;
	case FBIO_CURSOR:
		ret = -EINVAL;
		break;
	case FBIOGET_CON2FBMAP:
		if (copy_from_user(&con2fb, argp, sizeof(con2fb)))
			return -EFAULT;
		if (con2fb.console < 1 || con2fb.console > MAX_NR_CONSOLES)
			return -EINVAL;
		con2fb.framebuffer = -1;
		event.data = &con2fb;
		if (!lock_fb_info(info))
			return -ENODEV;
		event.info = info;
		fb_notifier_call_chain(FB_EVENT_GET_CONSOLE_MAP, &event);
		unlock_fb_info(info);
		ret = copy_to_user(argp, &con2fb, sizeof(con2fb)) ? -EFAULT : 0;
		break;
	case FBIOPUT_CON2FBMAP:
		if (copy_from_user(&con2fb, argp, sizeof(con2fb)))
			return -EFAULT;
		if (con2fb.console < 1 || con2fb.console > MAX_NR_CONSOLES)
			return -EINVAL;
		if (con2fb.framebuffer < 0 || con2fb.framebuffer >= FB_MAX)
			return -EINVAL;
		if (!registered_fb[con2fb.framebuffer])
			request_module("fb%d", con2fb.framebuffer);
		if (!registered_fb[con2fb.framebuffer]) {
			ret = -EINVAL;
			break;
		}
		event.data = &con2fb;
		if (!lock_fb_info(info))
			return -ENODEV;
		event.info = info;
		ret = fb_notifier_call_chain(FB_EVENT_SET_CONSOLE_MAP, &event);
		unlock_fb_info(info);
		break;
	case FBIOBLANK:
		if (!lock_fb_info(info))
			return -ENODEV;
		console_lock();
		info->flags |= FBINFO_MISC_USEREVENT;
		ret = fb_blank(info, arg);
		info->flags &= ~FBINFO_MISC_USEREVENT;
		console_unlock();
		unlock_fb_info(info);
		break;
	default:
		if (!lock_fb_info(info))
			return -ENODEV;
		fb = info->fbops;
		if (fb->fb_ioctl)
			ret = fb->fb_ioctl(info, cmd, arg);
		else
			ret = -ENOTTY;
		unlock_fb_info(info);
	}
	return ret;
}
{% endhighlight %}


## Summary
1. `fb_info` structure describes a framebuffer device
2. Call the interface function `register_framebuffer` provided by the framebuffer driver module to register the framebuffer device
3. The operation process of the framebuffer device file is:  firstly, the framebuffer driver function is executed, then the registered `fb_info` is obtained according to the minor device number of the registered framebuffer device, and finally the operation function of the specific framebuffer device is called
