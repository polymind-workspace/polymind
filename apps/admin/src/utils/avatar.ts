const CID_GATEWAY = 'https://api-wallet.endless.link/api/btc/cid-nft-gateway';

interface UserAvatarFields {
  cid?: string | null;
  avatar?: string | null;
}

export function resolveAvatar(user: UserAvatarFields | null | undefined): string {
  if (!user) return '';
  const cid = (user.cid || '').trim();
  if (cid) return `${CID_GATEWAY}/${cid}`;
  return (user.avatar || '').trim();
}
