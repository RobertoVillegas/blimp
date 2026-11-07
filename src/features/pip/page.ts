/**
 * Runs in the page (the in-page palette), right inside the key press or click that chose the
 * command, because browsers only open picture-in-picture during a user action in the page.
 * Nothing may be awaited before requestPictureInPicture().
 */
export function togglePictureInPicture(): Promise<string> {
  if (document.pictureInPictureElement) {
    return document
      .exitPictureInPicture()
      .then(() => "Closed picture in picture.");
  }
  if (!document.pictureInPictureEnabled)
    return Promise.reject(
      new Error("This browser has picture in picture turned off."),
    );

  const video = pickVideo();
  if (!video)
    return Promise.reject(
      new Error(
        "No video on this page. Videos inside embedded players (iframes) are not reachable yet.",
      ),
    );
  // The user asked for it explicitly, so a site's opt-out attribute doesn't get the last word.
  if (video.disablePictureInPicture) video.disablePictureInPicture = false;
  return video.requestPictureInPicture().then(
    () => "Opened picture in picture.",
    (error: Error) => {
      throw new Error(
        `The browser refused picture in picture (${error.message}).`,
      );
    },
  );
}

/** The playing video, else the largest visible one that has loaded something. */
function pickVideo(): HTMLVideoElement | undefined {
  const videos = [...document.querySelectorAll("video")].filter(
    (video) => video.readyState >= 1,
  );
  const area = (video: HTMLVideoElement) => {
    const rect = video.getBoundingClientRect();
    return rect.width * rect.height;
  };
  return (
    videos.find((video) => !video.paused && !video.ended) ??
    videos
      .filter((video) => area(video) > 0)
      .sort((a, b) => area(b) - area(a))[0]
  );
}
