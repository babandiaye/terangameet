import { AccessToken, TrackSource } from "livekit-server-sdk";
import { env } from "../config/env";
import { colorFromSeed } from "../utils/color";

const SOURCE_MAP: Record<string, TrackSource> = {
  camera: TrackSource.CAMERA,
  microphone: TrackSource.MICROPHONE,
  screen_share: TrackSource.SCREEN_SHARE,
  screen_share_audio: TrackSource.SCREEN_SHARE_AUDIO,
};

/**
 * Source names as the clients speak them ("microphone") to the numeric enum the
 * protocol expects. The RPC path needs this as much as the token does: sending
 * the raw strings makes protobuf refuse the whole request with
 * "cannot encode field livekit.ParticipantPermission.can_publish_sources".
 */
export function mapSources(sources?: string[]): TrackSource[] | undefined {
  if (!sources) return undefined;
  return sources
    .map((s) => SOURCE_MAP[s])
    .filter((s): s is TrackSource => s !== undefined);
}

export interface GenerateTokenParams {
  room: string;
  identity: string;
  name: string;
  color?: string;
  /** Media sources the participant may publish. Omit/empty → cannot publish. */
  sources?: string[];
  isAdminOrOwner?: boolean;
  /** Extra metadata merged into the participant metadata blob. */
  extraMetadata?: Record<string, unknown>;
}

/**
 * Generate a LiveKit access token, mirroring the Django backend's generate_token().
 */
export async function generateLiveKitToken(
  params: GenerateTokenParams,
): Promise<string> {
  const {
    room,
    identity,
    name,
    color,
    sources,
    isAdminOrOwner = false,
    extraMetadata,
  } = params;

  const metadata = JSON.stringify({
    color: color ?? colorFromSeed(identity),
    room_admin: isAdminOrOwner ? "true" : "false",
    ...extraMetadata,
  });

  const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
    identity,
    name,
    metadata,
    // Also an attribute, not only metadata: attributes are what clients read to
    // tell moderators apart, and unlike the token's roomAdmin grant they can be
    // flipped mid-session — which is how a co-host is promoted.
    attributes: { room_admin: isAdminOrOwner ? "true" : "false" },
    ttl: "6h",
  });

  const canPublishSources = mapSources(sources);
  at.addGrant({
    room,
    roomJoin: true,
    roomAdmin: isAdminOrOwner,
    canUpdateOwnMetadata: false,
    canSubscribe: true,
    canPublish: !!canPublishSources && canPublishSources.length > 0,
    ...(canPublishSources ? { canPublishSources } : {}),
  });

  return at.toJwt();
}
