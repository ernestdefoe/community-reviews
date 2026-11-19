<?php

declare(strict_types=1);

namespace ErnestDefoe\CommunityReviews\Http;

use ErnestDefoe\CommunityReviews\Stats;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** `GET /api/review-stats`: MyBB's Statistics block (items, reviews, comments, views), cached (Stats). */
class StatsController implements RequestHandlerInterface
{
    public function __construct(private readonly Stats $stats)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertPermission(RequestUtil::getActor($request)->hasPermission('communityReviews.view'));

        return new JsonResponse(['data' => ['type' => 'review-stats', 'id' => '1', 'attributes' => $this->stats->get()]]);
    }
}
