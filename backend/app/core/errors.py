from typing import Any, Dict, List, Optional
from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppException(HTTPException):
    def __init__(
        self,
        status_code: int,
        detail: str,
        code: str,
        fields: Optional[List[Dict[str, Any]]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.code = code
        self.fields = fields


class UnauthorizedException(AppException):
    def __init__(self, detail: str = "Not authenticated", code: str = "UNAUTHORIZED"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            code=code,
        )


class ForbiddenException(AppException):
    def __init__(self, detail: str = "Access forbidden", code: str = "FORBIDDEN"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code=code,
        )


class NotFoundException(AppException):
    def __init__(self, detail: str = "Resource not found", code: str = "NOT_FOUND"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            code=code,
        )


class ConflictException(AppException):
    def __init__(self, detail: str = "Conflict", code: str = "CONFLICT"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            code=code,
        )


class UnprocessableEntityException(AppException):
    def __init__(
        self,
        detail: str = "Unprocessable entity",
        code: str = "UNPROCESSABLE_ENTITY",
        fields: Optional[List[Dict[str, Any]]] = None,
    ):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
            code=code,
            fields=fields,
        )


class RateLimitException(AppException):
    def __init__(
        self,
        detail: str = "Too many failed login attempts. Please try again later.",
        code: str = "TOO_MANY_REQUESTS",
    ):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            code=code,
        )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    content: Dict[str, Any] = {
        "detail": exc.detail,
        "code": exc.code,
    }
    if exc.fields is not None:
        content["fields"] = exc.fields
    return JSONResponse(status_code=exc.status_code, content=content)


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = []
    for err in exc.errors():
        loc = err.get("loc", [])
        field_name = " -> ".join([str(x) for x in loc if x not in ("body", "query", "path")])
        errors.append({
            "field": field_name or str(loc[-1] if loc else "unknown"),
            "message": err.get("msg", ""),
            "type": err.get("type", ""),
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "code": "VALIDATION_ERROR",
            "fields": errors,
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    # Handle standard HTTPExceptions
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "TOO_MANY_REQUESTS",
        500: "INTERNAL_SERVER_ERROR",
    }
    code = getattr(exc, "code", code_map.get(exc.status_code, "ERROR"))
    content: Dict[str, Any] = {
        "detail": str(exc.detail),
        "code": code,
    }
    fields = getattr(exc, "fields", None)
    if fields is not None:
        content["fields"] = fields
    return JSONResponse(status_code=exc.status_code, content=content)
