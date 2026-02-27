import type { APIRoute, GetStaticPaths } from 'astro';
import { generateOgPng } from '@/utils/og-image';

export const getStaticPaths: GetStaticPaths = () => {
  return [{ params: { locale: 'en' } }, { params: { locale: 'ko' } }];
};

export const GET: APIRoute = async ({ params }) => {
  const png = await generateOgPng(params.locale as string);
  return new Response(png, {
    headers: { 'Content-Type': 'image/png' },
  });
};
