import type { UserResults } from './api';

interface Props {
  error: string;
  pending: boolean;
  data?: UserResults;
  reload: () => void;
}
const UserSearchStatus = ({ error, pending, data, reload }: Props) => {
  if (error)
    return (
      <p role="alert">
        {error}{' '}
        <button type="button" onClick={reload}>
          Retry search
        </button>
      </p>
    );
  if (pending) return <p role="status">Searching…</p>;
  if (data?.total === 0)
    return <p role="status">No matching users. Try another search or change the filters.</p>;
  return <p role="status">{data?.total ?? 0} users found</p>;
};
export default UserSearchStatus;
