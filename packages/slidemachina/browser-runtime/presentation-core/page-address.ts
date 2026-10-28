// Sets or drops one search parameter of the current address; every empty value is written as a bare "?name". The hash stays.
export function describeAddressWithParameter(parameterName: string, parameterValue: string | undefined, startAddress = location.href): string {
  const pageAddress = new URL(startAddress);
  pageAddress.searchParams.delete(parameterName);
  if (parameterValue !== undefined) pageAddress.searchParams.set(parameterName, parameterValue);
  pageAddress.search = pageAddress.search.replace(/([?&][^=&]+)=(?=&|$)/g, "$1");
  return pageAddress.href;
}
