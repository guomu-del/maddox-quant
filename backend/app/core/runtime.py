import os


def is_serverless() -> bool:
    return any(
        os.getenv(name)
        for name in (
            "VERCEL",
            "VERCEL_ENV",
            "VERCEL_REGION",
            "AWS_LAMBDA_FUNCTION_NAME",
            "AWS_EXECUTION_ENV",
            "LAMBDA_TASK_ROOT",
        )
    )


def scheduler_enabled() -> bool:
    flag = os.getenv("ENABLE_SCHEDULER", "").strip().lower()
    if flag in {"0", "false", "no"}:
        return False
    if flag in {"1", "true", "yes"}:
        return True
    return not is_serverless()
