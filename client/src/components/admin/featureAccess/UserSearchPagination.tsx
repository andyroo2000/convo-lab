interface Props {
  page: number;
  lastPage: number;
  pending: boolean;
  onPage: (page: number) => void;
}
const UserSearchPagination = ({ page, lastPage, pending, onPage }: Props) => (
  <div className="access-pagination">
    <button type="button" disabled={page <= 1 || pending} onClick={() => onPage(page - 1)}>
      Previous
    </button>
    <span>
      Page {page} of {lastPage}
    </span>
    <button type="button" disabled={page >= lastPage || pending} onClick={() => onPage(page + 1)}>
      Next
    </button>
  </div>
);
export default UserSearchPagination;
