import api from './api';

export async function uploadToCloudinary(file: File, folder = 'sphinx-hr') {
    const sign = await api.get(`/cloudinary/sign?folder=${encodeURIComponent(folder)}`);
    const { signature, timestamp, cloudName, apiKey } = sign.data;

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', apiKey);
    form.append('timestamp', timestamp.toString());
    form.append('signature', signature);
    form.append('folder', folder);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: form,
    });

    if (!response.ok) {
        throw new Error('Cloudinary upload failed');
    }

    const data = await response.json();
    return data.secure_url as string;
}
