import api from "./client";
import type { AuthResponse, PublicUser } from "../types";

export async function register(input: {
  name: string;
  email: string;
  password: string;
}) {
  const { data } = await api.post<AuthResponse>("/auth/register", input);
  return data;
}

export async function login(input: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>("/auth/login", input);
  return data;
}

export async function logout(refreshToken?: string | null) {
  await api.post("/auth/logout", { refreshToken });
}

export async function me() {
  const { data } = await api.get<{ user: PublicUser }>("/auth/me");
  return data.user;
}
