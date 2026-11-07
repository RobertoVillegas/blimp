// Registered at runtime only while "Float videos when I switch tabs" is on. Tells the browser this
// page supports automatic picture-in-picture: when the user leaves the tab while a video plays,
// Chromium calls this handler and floats the video (it may ask the user once per site).
export default defineContentScript({
  registration: 'runtime',
  matches: ['http://*/*', 'https://*/*'],

  main(ctx) {
    let registered = false;

    const playingVideo = () =>
      [...document.querySelectorAll('video')].find((video) => !video.paused && !video.ended && video.readyState >= 2 && video.videoWidth > 0);

    const register = () => {
      if (registered || !playingVideo() || !navigator.mediaSession) return;
      try {
        navigator.mediaSession.setActionHandler('enterpictureinpicture' as MediaSessionAction, () => {
          const video = playingVideo();
          if (!video || document.pictureInPictureElement) return;
          if (video.disablePictureInPicture) video.disablePictureInPicture = false;
          void video.requestPictureInPicture().catch(() => undefined);
        });
        registered = true;
        if (import.meta.env.MODE.startsWith('e2e')) document.documentElement.dataset.heliumMaxAutoFloat = 'ready';
      } catch {
        // This browser doesn't know the action; nothing to do.
      }
    };

    // Videos start after load on most sites; listen for any playback start.
    ctx.addEventListener(document, 'play', register, { capture: true });
    register();
  },
});
