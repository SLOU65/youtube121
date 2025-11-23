import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { YouTubeAPI } from "./youtube";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // YouTube API Key Management
  youtube: router({
    

    // Save/Update YouTube API key
    saveApiKey: publicProcedure
      .input(z.object({ apiKey: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        // Validate the API key first
        const youtube = new YouTubeAPI(input.apiKey);
        const isValid = await youtube.validateApiKey();

        if (!isValid) {
          throw new Error('Invalid YouTube API key');
        }

        // Ключ будет храниться на клиенте, поэтому логика сохранения в БД удалена.
        return { success: true };
      }),

    

    // Search
    search: publicProcedure
      .input(z.object({
        q: z.string().optional(),
        type: z.enum(['video', 'channel', 'playlist']).optional(),
        order: z.enum(['date', 'rating', 'relevance', 'title', 'videoCount', 'viewCount']).optional(),
        publishedAfter: z.string().optional(),
        publishedBefore: z.string().optional(),
        videoDuration: z.enum(['short', 'medium', 'long', 'any']).optional(),
        videoDefinition: z.enum(['high', 'standard', 'any']).optional(),
        videoDimension: z.enum(['2d', '3d', 'any']).optional(),
        videoEmbeddable: z.enum(['true', 'any']).optional(),
        videoLicense: z.enum(['creativeCommon', 'youtube', 'any']).optional(),
        videoSyndicated: z.enum(['true', 'any']).optional(),
        videoType: z.enum(['episode', 'movie', 'any']).optional(),
        videoCategoryId: z.string().optional(),
        regionCode: z.string().optional(),
        relevanceLanguage: z.string().optional(),
        safeSearch: z.enum(['moderate', 'none', 'strict']).optional(),
        maxResults: z.number().optional(),
        pageToken: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.search(input);
      }),

    // Videos
    getVideo: publicProcedure
      .input(z.object({ videoId: z.string() }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.getVideo(input.videoId);
      }),

    getVideos: publicProcedure
      .input(z.object({ videoIds: z.array(z.string()) }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.getVideos(input.videoIds);
      }),

    getMostPopular: publicProcedure
      .input(z.object({
        regionCode: z.string().optional(),
        maxResults: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.getMostPopularVideos(input.regionCode, input.maxResults);
      }),

    // Channels
    getChannel: publicProcedure
      .input(z.object({ channelId: z.string() }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.getChannel(input.channelId);
      }),

    getChannelByUsername: publicProcedure
      .input(z.object({ username: z.string() }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.getChannelsByUsername(input.username);
      }),

    getChannelVideos: publicProcedure
      .input(z.object({ 
        channelId: z.string(),
        maxResults: z.number().optional(),
        pageToken: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.searchChannelVideos(
          input.channelId,
          input.maxResults || 12,
          input.pageToken
        );
      }),

    // Playlists
    getPlaylist: publicProcedure
      .input(z.object({ playlistId: z.string() }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.getPlaylist(input.playlistId);
      }),

    getPlaylistItems: publicProcedure
      .input(z.object({
        playlistId: z.string(),
        maxResults: z.number().optional(),
        pageToken: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.getPlaylistItems(input.playlistId, input.maxResults, input.pageToken);
      }),

    // Comments
    getVideoComments: publicProcedure
      .input(z.object({
        videoId: z.string(),
        maxResults: z.number().optional(),
        pageToken: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.getVideoComments(input.videoId, input.maxResults, input.pageToken);
      }),

    getCommentReplies: publicProcedure
      .input(z.object({
        parentId: z.string(),
        maxResults: z.number().optional(),
        pageToken: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.getCommentReplies(input.parentId, input.maxResults, input.pageToken);
      }),

    // Subscriptions
    getSubscriptions: publicProcedure
      .input(z.object({
        channelId: z.string(),
        maxResults: z.number().optional(),
        pageToken: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const apiKey = ctx.req.headers['x-youtube-api-key'] as string | undefined;
        if (!apiKey) {
          throw new Error('No active YouTube API key found');
        }

        const youtube = new YouTubeAPI(apiKey);
        return youtube.getSubscriptions(input.channelId, input.maxResults, input.pageToken);
      }),
  }),


});

export type AppRouter = typeof appRouter;
