import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { latitude, longitude } = body;

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude e longitude são obrigatórias' },
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
    mapUrl.searchParams.append('center', `${latitude},${longitude}`);
    mapUrl.searchParams.append('zoom', '15');
    mapUrl.searchParams.append('size', '640x480');
    mapUrl.searchParams.append('markers', `color:red|${latitude},${longitude}`);
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
