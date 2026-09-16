export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}
