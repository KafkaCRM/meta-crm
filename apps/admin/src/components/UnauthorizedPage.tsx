export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md text-center">
        <h1 className="mb-4 text-2xl font-bold text-red-600">Unauthorized</h1>
        <p className="text-gray-600">
          You do not have platform access. Please contact your administrator.
        </p>
      </div>
    </div>
  );
}
