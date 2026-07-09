/**
 * NextAuth-shaped placeholder configuration.
 *
 * When real authentication lands, install next-auth, replace this object
 * with a genuine NextAuthOptions, and add
 * app/api/auth/[...nextauth]/route.ts — nothing else should move.
 */
export const authOptions = {
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/",
  },
  providers: [] as unknown[],
};
