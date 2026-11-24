import { NextRequest, NextResponse } from 'next/server';
import { usuarioAtual } from '@/lib/auth';

export async function POST(request: NextRequest) {
  // Consome cota paga da chave do Google Maps: só para usuários logados.
  if (!(await usuarioAtual())) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  try {
    let body: { latitude?: unknown; longitude?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
    }

    const lat = typeof body.latitude === 'number' ? body.latitude : Number(body.latitude);
    const lng = typeof body.longitude === 'number' ? body.longitude : Number(body.longitude);

    if (
      body.latitude === undefined || body.latitude === null || body.latitude === '' ||
      body.longitude === undefined || body.longitude === null || body.longitude === '' ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      return NextResponse.json(
        { error: 'Latitude e longitude válidas são obrigatórias' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY não configurada');
      return NextResponse.json(
        { error: 'API key não configurada' },
        { status: 500 }
      );
    }

    const mapUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
    mapUrl.searchParams.append('center', `${lat},${lng}`);
    mapUrl.searchParams.append('zoom', '15');
    mapUrl.searchParams.append('size', '640x480');
    mapUrl.searchParams.append('markers', `color:red|${lat},${lng}`);
    mapUrl.searchParams.append('key', apiKey);

    const response = await fetch(mapUrl.toString());

    if (!response.ok) {
      console.error(`Google Maps API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Falha ao gerar mapa' },
        { status: response.status }
      );
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return NextResponse.json({
      base64,
      contentType: 'image/png',
      width: 640,
      height: 480,
    });
  } catch (error) {
    console.error('Erro ao gerar mapa:', error);
    return NextResponse.json(
      { error: 'Erro interno ao gerar mapa' },
      { status: 500 }
    );
  }
}
