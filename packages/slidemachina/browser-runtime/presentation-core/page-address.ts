// Sets or drops one search parameter of the current address; an empty value is written as a bare "?name". The hash stays.
export function describeAddressWithParameter(parameterName: string, parameterValue: string | undefined): string {
  const pageAddress = new URL(location.href);
  pageAddress.searchParams.delete(parameterName);
  if (parameterValue !== undefined) pageAddress.searchParams.set(parameterName, parameterValue);
  pageAddress.search = pageAddress.search.replace(new RegExp(`([?&]${parameterName})=(?=&|$)`), "$1");
  return pageAddress.href;
}
