import { Router } from "express";
import axios from "axios";
import prisma from "../lib/prisma.js";
import { generateCsrfToken, getClientIp, hashIp } from "../lib/security.js";
import { authLimiter } from "../middleware/rateLimiters.js";

const router = Router();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

router.get("/login", authLimiter, (req, res) => {
  const clientId = requireEnv("DISCORD_CLIENT_ID");
  const redirectUri = requireEnv("DISCORD_REDIRECT_URI");

  const state = generateCsrfToken();
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "identify",
    state,
  });

  return req.session.save(() => {
    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });
});

router.get("/callback", authLimiter, async (req, res) => {
  try {
    const clientId = requireEnv("DISCORD_CLIENT_ID");
    const clientSecret = requireEnv("DISCORD_CLIENT_SECRET");
    const redirectUri = requireEnv("DISCORD_REDIRECT_URI");

    const { code, state } = req.query;

    if (!code || typeof code !== "string") {
      return res.status(400).send("Falta el parámetro code.");
    }

    if (!state || typeof state !== "string") {
      return res.status(400).send("Falta el parámetro state.");
    }

    if (!req.session.oauthState || state !== req.session.oauthState) {
      return res.status(400).send("State inválido.");
    }

    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
      return res.status(400).send("No se pudo obtener el access token de Discord.");
    }

    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const discordUser = userResponse.data;
    if (!discordUser?.id) {
      return res.status(400).send("No se pudo obtener el usuario de Discord.");
    }

    const adminDiscordIds = String(process.env.ADMIN_DISCORD_IDS || process.env.ADMIN_DISCORD_ID || "")
      .split(",")
     .map((id) => id.trim())
      .filter(Boolean);

    const isAdmin = adminDiscordIds.includes(String(discordUser.id));

    const username =
      discordUser.username ||
      discordUser.global_name ||
      `user_${discordUser.id}`;

    const globalName = discordUser.global_name || null;
    const avatar = discordUser.avatar || null;

    const user = await prisma.user.upsert({
      where: {
        discordId: String(discordUser.id),
      },
      update: {
        username,
        globalName,
        avatar,
        isAdmin,
      },
      create: {
        discordId: String(discordUser.id),
        username,
        globalName,
        avatar,
        isAdmin,
      },
    });

    const clientIp = getClientIp(req);
    const ipHash = hashIp(clientIp);
    const userAgent = req.get("user-agent") || null;

    await prisma.userSession.create({
      data: {
        userId: user.id,
        ipHash,
        userAgent,
      },
    }).catch(() => {
      // Si falla este log, no rompe el login
    });

    req.session.userId = user.id;
    req.session.csrfToken = generateCsrfToken();
    delete req.session.oauthState;

    return req.session.save((err) => {
      if (err) {
        console.error("Error guardando la sesión:", err);
        return res.status(500).send("No se pudo guardar la sesión.");
      }

      return res.redirect("/vote");
    });
  } catch (error) {
    console.error("Discord OAuth callback error:", error?.response?.data || error);
    return res.status(500).send("Error durante la autenticación con Discord.");
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "No se pudo cerrar la sesión." });
    }

    res.clearCookie("connect.sid");
    return res.json({ success: true });
  });
});

export default router;