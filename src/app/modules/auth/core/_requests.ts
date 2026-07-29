import axios from "axios";
import { AuthModel, UserModel } from "./_models";

const API_URL = import.meta.env.VITE_APP_API_URL;

export const GET_USER_BY_ACCESSTOKEN_URL = `${API_URL}/verify_token`;
export const LOGIN_URL = `${API_URL}/login`;
export const REGISTER_URL = `${API_URL}/register`;
export const REQUEST_PASSWORD_URL = `${API_URL}/forgot_password`;

// ---- Mock local (sin backend): entrar con admin@demo.com / demo ----
const DEMO_EMAIL = "admin@demo.com";
const DEMO_PASSWORD = "demo";
const DEMO_TOKEN = "demo-mock-token";

const DEMO_USER: UserModel = {
  id: 1,
  username: "admin",
  password: undefined,
  email: DEMO_EMAIL,
  first_name: "Admin",
  last_name: "Demo",
  fullname: "Admin Demo",
  roles: [1],
  language: "es",
  auth: { api_token: DEMO_TOKEN },
};

// Server should return AuthModel
export function login(email: string, password: string) {
  if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
    return Promise.resolve({ data: { api_token: DEMO_TOKEN } as AuthModel });
  }
  return Promise.reject(new Error("Credenciales invalidas"));
}

// Server should return AuthModel
export function register(
  email: string,
  firstname: string,
  lastname: string,
  password: string,
  password_confirmation: string
) {
  return axios.post(REGISTER_URL, {
    email,
    first_name: firstname,
    last_name: lastname,
    password,
    password_confirmation,
  });
}

// Server should return object => { result: boolean } (Is Email in DB)
export function requestPassword(email: string) {
  return axios.post<{ result: boolean }>(REQUEST_PASSWORD_URL, {
    email,
  });
}

export function getUserByToken(_token: string) {
  // Mock local: cualquier token valido devuelve el usuario demo.
  return Promise.resolve({ data: DEMO_USER });
}
