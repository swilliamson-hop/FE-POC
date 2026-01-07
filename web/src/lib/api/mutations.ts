import { graphqlClient } from './graphql-client';
import type { ApplyAsGuestResponse, GuestDataInput } from '../types/application';

const APPLY_AS_GUEST_MUTATION = `
  mutation applyAsGuest($guestData: GuestDataInput, $token: String!) {
    applyAsGuest(guestData: $guestData, token: $token) {
      status
      statusText
    }
  }
`;

export async function applyAsGuest(
  guestData: GuestDataInput,
  token: string
): Promise<ApplyAsGuestResponse['applyAsGuest']> {
  const data = await graphqlClient.request<ApplyAsGuestResponse>(
    APPLY_AS_GUEST_MUTATION,
    { guestData, token }
  );
  return data.applyAsGuest;
}
