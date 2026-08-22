import { describe, it, expect } from "vitest";
import { TrackSource } from "livekit-server-sdk";
import { mapSources } from "./token";

describe("mapSources", () => {
  it("maps every source name the clients send", () => {
    expect(
      mapSources([
        "camera",
        "microphone",
        "screen_share",
        "screen_share_audio",
      ]),
    ).toEqual([
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ]);
  });

  it("returns numbers, not names", () => {
    // The bug this guards: passing the raw strings on to the RPC made protobuf
    // refuse the whole UpdateParticipantRequest, so muting never took effect.
    for (const v of mapSources(["microphone"]) ?? []) {
      expect(typeof v).toBe("number");
    }
  });

  it('honours an empty list as "nothing may be published"', () => {
    expect(mapSources([])).toEqual([]);
  });

  it('distinguishes "not specified" from "nothing"', () => {
    expect(mapSources(undefined)).toBeUndefined();
  });

  it("drops names it does not know rather than emitting undefined", () => {
    expect(mapSources(["microphone", "teleport"])).toEqual([
      TrackSource.MICROPHONE,
    ]);
  });
});
