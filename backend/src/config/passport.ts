import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './index';
import { prisma } from '../services/prisma';

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0].value;
          if (!email) {
            return done(new Error('No email found from Google'), undefined);
          }

          let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

          if (!user) {
            user = await prisma.user.findUnique({ where: { email } });
            if (user) {
              user = await prisma.user.update({
                where: { email },
                data: {
                  googleId: profile.id,
                  name: profile.displayName || user.name,
                  avatarUrl: profile.photos?.[0].value || user.avatarUrl,
                },
              });
            } else {
              user = await prisma.user.create({
                data: {
                  googleId: profile.id,
                  email,
                  name: profile.displayName,
                  avatarUrl: profile.photos?.[0].value,
                },
              });
            }
          } else {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                name: profile.displayName || user.name,
                avatarUrl: profile.photos?.[0].value || user.avatarUrl,
              },
            });
          }

          done(null, user);
        } catch (error) {
          done(error, undefined);
        }
      }
    )
  );
} else {
  console.warn('[ReachInbox] Google OAuth not configured. Skipping Passport setup.');
}
