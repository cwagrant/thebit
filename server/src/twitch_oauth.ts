import axios from "axios";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

export interface TwitchTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string[];
  token_type: string;
}

export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<TwitchTokenResponse> {
  const response = await axios.post<TwitchTokenResponse>(TOKEN_URL, null, {
    params: {
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: params.redirectUri
    }
  });

  return response.data;
}

export async function refreshAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TwitchTokenResponse> {
  const response = await axios.post<TwitchTokenResponse>(TOKEN_URL, null, {
    params: {
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token"
    }
  });

  return response.data;
}
