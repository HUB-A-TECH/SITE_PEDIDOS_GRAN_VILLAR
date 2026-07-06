import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string; // id do usuário
  username: string;
  type: string;
  localId: string | null;
  jti: string;
  iat?: number;
  exp?: number;
}

export function signToken(user: {
  id: string;
  username: string;
  type: string;
  localId: string | null;
}): { token: string; jti: string } {
  const jti = randomUUID();
  const options: SignOptions = {
    subject: user.id,
    jwtid: jti,
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  const token = jwt.sign(
    { username: user.username, type: user.type, localId: user.localId },
    env.jwtSecret,
    options,
  );
  return { token, jti };
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
